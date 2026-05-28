"""
Nativeify Backend — Transcription Route

POST /api/v1/transcribe
  Accepts an audio file upload, converts it to 16kHz mono WAV,
  and transcribes it using faster-whisper.

  Multipart form fields:
    audio       : UploadFile  — the audio file (wav/mp3/ogg/flac/m4a/webm)
    language    : str         — language hint (default: "en")
    vad_filter  : bool        — enable VAD silence filtering (default: true)
    denoise     : bool        — apply FFmpeg noise reduction (default: false)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from loguru import logger

from app.core.dependencies import get_audio_service, get_transcription_service
from app.models.schemas import ErrorResponse, TranscribeResponse
from app.services.audio import AudioService, AudioProcessingError
from app.services.transcription import TranscriptionService, TranscriptionError

router = APIRouter()

# Max upload size: 100 MB
MAX_UPLOAD_BYTES = 100 * 1024 * 1024


@router.post(
    "",
    response_model=TranscribeResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe Audio",
    description=(
        "Upload an audio file and receive a full text transcription "
        "with word-level timestamps. "
        "Supported formats: WAV, MP3, OGG, FLAC, M4A, WebM."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid audio file"},
        413: {"model": ErrorResponse, "description": "File too large"},
        422: {"model": ErrorResponse, "description": "Audio too short or too long"},
        500: {"model": ErrorResponse, "description": "Transcription failed"},
        503: {"model": ErrorResponse, "description": "Whisper service unavailable"},
    },
    tags=["Transcription"],
)
async def transcribe_audio(
    audio: Annotated[UploadFile, File(description="Audio file to transcribe")],
    language: Annotated[str, Form(description="Language hint, e.g. 'en'")] = "en",
    vad_filter: Annotated[bool, Form(description="Enable Voice Activity Detection")] = True,
    denoise: Annotated[bool, Form(description="Apply noise reduction before transcription")] = False,
    transcription_svc: TranscriptionService = Depends(get_transcription_service),
    audio_svc: AudioService = Depends(get_audio_service),
) -> TranscribeResponse:
    """
    Full transcription pipeline:
    1. Validate and save the uploaded audio file
    2. (Optional) Apply noise reduction
    3. Convert to 16kHz mono WAV for Whisper
    4. Transcribe and return results

    Temporary files are cleaned up automatically after processing.
    """
    upload_path = None
    processed_path = None
    denoised_path = None

    try:
        # ── 1. Validate upload ────────────────────────────
        if not audio.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No filename provided with the upload.",
            )

        content = await audio.read()

        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large ({len(content) / 1024 / 1024:.1f} MB). Max: 100 MB.",
            )

        logger.info(
            "Transcribe request | file='{}' | size={:.1f}KB | lang={} | vad={} | denoise={}",
            audio.filename,
            len(content) / 1024,
            language,
            vad_filter,
            denoise,
        )

        # ── 2. Save uploaded bytes ────────────────────────
        upload_path = await audio_svc.save_upload(content, audio.filename)

        # ── 3. Validate duration ──────────────────────────
        try:
            duration = await audio_svc.validate_duration(upload_path)
            logger.debug("Audio duration: {:.2f}s", duration)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            )

        # ── 4. Optional noise reduction ───────────────────
        working_path = upload_path
        if denoise:
            logger.info("Applying noise reduction...")
            try:
                denoised_path = await audio_svc.reduce_noise(working_path)
                working_path = denoised_path
            except AudioProcessingError as exc:
                logger.warning("Noise reduction failed (skipping): {}", exc)
                # Non-fatal — continue with original audio

        # ── 5. Convert to 16kHz mono WAV ──────────────────
        try:
            processed_path = await audio_svc.prepare_for_transcription(working_path)
        except AudioProcessingError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Audio conversion failed: {exc}. "
                       f"Ensure FFmpeg is installed and the file is a valid audio file.",
            )

        # ── 6. Transcribe ─────────────────────────────────
        try:
            result = await transcription_svc.transcribe(
                audio_path=processed_path,
                language=language,
                vad_filter=vad_filter,
            )
        except TranscriptionError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Transcription failed: {exc}",
            )

        logger.info(
            "✅ Transcription done | {} chars | lang={} | duration={:.1f}s",
            len(result.text),
            result.language,
            result.duration,
        )
        return result

    finally:
        # ── Cleanup temporary files ────────────────────────
        for path in [upload_path, processed_path, denoised_path]:
            if path is not None:
                await audio_svc.delete_file(path)
