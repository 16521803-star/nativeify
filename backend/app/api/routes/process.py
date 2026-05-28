"""
Nativeify Backend — Full Pipeline Route

POST /api/v1/process-all
  Runs the complete audio processing pipeline in a single request:
    1. Transcribe (faster-whisper)
    2. Correct grammar & fluency (Ollama LLM)
    3. Synthesise native-English audio (XTTS-v2)

  Multipart form fields:
    audio        : UploadFile  — input audio (wav/mp3/ogg/flac/m4a/webm)
    options      : str (JSON)  — ProcessOptions as JSON string
    voice_sample : UploadFile  — (optional) voice cloning sample

  JSON options fields:
    language   : str   — transcription language (default: "en")
    speaker    : str   — speaker mode (default: "us_female")
    style      : str   — correction style (default: "native")
    vad_filter : bool  — enable VAD (default: true)
    speed      : float — TTS speed (default: 1.0)
    denoise    : bool  — noise reduction (default: false)
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from loguru import logger

from app.core.dependencies import (
    get_audio_service,
    get_correction_service,
    get_synthesis_service,
    get_transcription_service,
)
from app.models.schemas import (
    CorrectionStyle,
    ErrorResponse,
    ProcessAllResponse,
    ProcessOptions,
    ProcessTimings,
    SpeakerMode,
)
from app.services.audio import AudioProcessingError, AudioService
from app.services.correction import CorrectionError, CorrectionService, OllamaConnectionError
from app.services.synthesis import SynthesisError, SynthesisService
from app.services.transcription import TranscriptionError, TranscriptionService

router = APIRouter()

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_SAMPLE_BYTES = 10 * 1024 * 1024


@router.post(
    "",
    response_model=ProcessAllResponse,
    status_code=status.HTTP_200_OK,
    summary="Full Pipeline (Transcribe → Correct → Synthesise)",
    description=(
        "One-shot endpoint that runs the entire Nativeify pipeline. "
        "Upload an audio file and receive the transcription, corrected text, "
        "and a synthesised native-English audio file — all in one request.\n\n"
        "Each step's duration is reported in `timings` for performance monitoring."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid audio file or options"},
        413: {"model": ErrorResponse, "description": "File too large"},
        422: {"model": ErrorResponse, "description": "Audio duration out of bounds"},
        500: {"model": ErrorResponse, "description": "Pipeline step failed"},
        503: {"model": ErrorResponse, "description": "A service is unavailable"},
    },
    tags=["Pipeline"],
)
async def process_all(
    audio: Annotated[UploadFile, File(description="Input audio file to process")],
    options: Annotated[
        str,
        Form(
            description=(
                'JSON options: {"language":"en","speaker":"us_female",'
                '"style":"native","vad_filter":true,"speed":1.0,"denoise":false}'
            )
        ),
    ] = "{}",
    voice_sample: Annotated[
        Optional[UploadFile],
        File(description="Optional voice sample for cloning (speaker=preserve)"),
    ] = None,
    transcription_svc: TranscriptionService = Depends(get_transcription_service),
    correction_svc: CorrectionService = Depends(get_correction_service),
    synthesis_svc: SynthesisService = Depends(get_synthesis_service),
    audio_svc: AudioService = Depends(get_audio_service),
) -> ProcessAllResponse:
    """
    Full sequential pipeline:
    transcribe → correct → synthesise

    Each step measures its own duration.
    On any step failure, the error is returned with the step name.
    All temporary files are cleaned up in the finally block.
    """
    upload_path: Optional[Path] = None
    processed_path: Optional[Path] = None
    denoised_path: Optional[Path] = None
    voice_sample_path: Optional[Path] = None
    pipeline_start = time.perf_counter()

    try:
        # ── Parse options ─────────────────────────────────
        try:
            opts_raw = json.loads(options) if options.strip() else {}
            opts = ProcessOptions(**opts_raw)
        except (json.JSONDecodeError, Exception) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid options JSON: {exc}",
            )

        # ── Validate upload ───────────────────────────────
        if not audio.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No filename provided with the audio upload.",
            )

        content = await audio.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty.",
            )
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large ({len(content)/1024/1024:.1f} MB). Max: 100 MB.",
            )

        logger.info(
            "🚀 Pipeline start | file='{}' | {:.1f}KB | speaker={} | style={} | lang={}",
            audio.filename,
            len(content) / 1024,
            opts.speaker.value,
            opts.style.value,
            opts.language,
        )

        # ── Save upload ───────────────────────────────────
        upload_path = await audio_svc.save_upload(content, audio.filename)

        # ── Validate duration ─────────────────────────────
        try:
            await audio_svc.validate_duration(upload_path)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            )

        # ── Optional noise reduction ──────────────────────
        working_path = upload_path
        if opts.vad_filter:  # Reuse vad_filter flag loosely as "pre-processing on"
            pass  # VAD is handled inside Whisper directly

        # Apply denoise if requested via options
        denoise = opts_raw.get("denoise", False)
        if denoise:
            try:
                denoised_path = await audio_svc.reduce_noise(working_path)
                working_path = denoised_path
                logger.debug("Noise reduction applied")
            except AudioProcessingError as exc:
                logger.warning("Noise reduction skipped: {}", exc)

        # ── Convert to 16kHz mono WAV ─────────────────────
        try:
            processed_path = await audio_svc.prepare_for_transcription(working_path)
        except AudioProcessingError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Audio preprocessing failed: {exc}",
            )

        # ── Handle voice sample ───────────────────────────
        if voice_sample is not None and voice_sample.filename:
            sample_content = await voice_sample.read()
            if 0 < len(sample_content) <= MAX_SAMPLE_BYTES:
                raw_sample = await audio_svc.save_upload(
                    sample_content, voice_sample.filename
                )
                try:
                    voice_sample_path = await audio_svc.prepare_for_transcription(raw_sample)
                except AudioProcessingError:
                    voice_sample_path = None
                finally:
                    await audio_svc.delete_file(raw_sample)

        # ──────────────────────────────────────────────────
        #  STEP 1: TRANSCRIBE
        # ──────────────────────────────────────────────────
        t1 = time.perf_counter()
        logger.info("Step 1/3: Transcribing...")

        try:
            transcription = await transcription_svc.transcribe(
                audio_path=processed_path,
                language=opts.language,
                vad_filter=opts.vad_filter,
            )
        except TranscriptionError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"[Transcription] {exc}",
            )

        t1_elapsed = time.perf_counter() - t1
        logger.info(
            "✅ Step 1 done | {:.2f}s | {} chars",
            t1_elapsed,
            len(transcription.text),
        )

        if not transcription.text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Transcription returned empty text. "
                    "The audio may be silent, too noisy, or not in English. "
                    "Try enabling noise reduction or uploading a clearer recording."
                ),
            )

        # ──────────────────────────────────────────────────
        #  STEP 2: CORRECT
        # ──────────────────────────────────────────────────
        t2 = time.perf_counter()
        logger.info("Step 2/3: Correcting grammar...")

        try:
            correction = await correction_svc.correct(
                text=transcription.text,
                style=opts.style,
            )
        except OllamaConnectionError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"[Correction] Ollama unavailable: {exc}",
            )
        except CorrectionError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"[Correction] {exc}",
            )

        t2_elapsed = time.perf_counter() - t2
        logger.info(
            "✅ Step 2 done | {:.2f}s | {} changes",
            t2_elapsed,
            correction.changes_count,
        )

        # ──────────────────────────────────────────────────
        #  STEP 3: SYNTHESISE
        # ──────────────────────────────────────────────────
        t3 = time.perf_counter()
        logger.info("Step 3/3: Synthesising audio...")

        # Use corrected text for synthesis (or original if no changes)
        synthesis_text = correction.corrected or transcription.text

        try:
            synthesis = await synthesis_svc.synthesize(
                text=synthesis_text,
                speaker=opts.speaker,
                speed=opts.speed,
                voice_sample_path=voice_sample_path,
            )
        except SynthesisError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"[Synthesis] {exc}",
            )

        t3_elapsed = time.perf_counter() - t3
        logger.info(
            "✅ Step 3 done | {:.2f}s | audio: {}",
            t3_elapsed,
            synthesis.audio_url,
        )

        # ── Build response ────────────────────────────────
        total_elapsed = time.perf_counter() - pipeline_start
        logger.info(
            "🎉 Pipeline complete | total={:.2f}s | "
            "transcribe={:.2f}s correct={:.2f}s synthesise={:.2f}s",
            total_elapsed,
            t1_elapsed,
            t2_elapsed,
            t3_elapsed,
        )

        return ProcessAllResponse(
            transcription=transcription,
            correction=correction,
            synthesis=synthesis,
            timings=ProcessTimings(
                transcription_s=round(t1_elapsed, 3),
                correction_s=round(t2_elapsed, 3),
                synthesis_s=round(t3_elapsed, 3),
                total_s=round(total_elapsed, 3),
            ),
        )

    finally:
        # ── Cleanup all temp files ────────────────────────
        for path in [upload_path, processed_path, denoised_path, voice_sample_path]:
            if path is not None:
                await audio_svc.delete_file(path)
