"""
Nativeify Backend — Speech Synthesis Route

POST /api/v1/synthesize
  Synthesises native-quality English audio from corrected text.

  Multipart form fields:
    data         : str (JSON)  — SynthesizeRequest as JSON string
    voice_sample : UploadFile  — (optional) WAV sample for voice cloning
                                  Required only when speaker="preserve"

  JSON data fields:
    text    : str         — the text to synthesise
    speaker : str         — "preserve" | "us_male" | "us_female" | "british"
    speed   : float       — speech rate multiplier (0.5 – 2.0, default 1.0)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from loguru import logger

from app.core.dependencies import get_audio_service, get_synthesis_service
from app.models.schemas import ErrorResponse, SpeakerMode, SynthesizeResponse
from app.services.audio import AudioService, AudioProcessingError
from app.services.synthesis import SynthesisError, SynthesisService

router = APIRouter()

# Max voice sample size: 10 MB
MAX_SAMPLE_BYTES = 10 * 1024 * 1024


@router.post(
    "",
    response_model=SynthesizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Synthesise Speech",
    description=(
        "Generate native-English audio from text. "
        "Choose from built-in speaker presets or clone the user's own voice "
        "by uploading a short WAV sample (~6 seconds recommended)."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request or voice sample"},
        500: {"model": ErrorResponse, "description": "TTS synthesis failed"},
        503: {"model": ErrorResponse, "description": "TTS service unavailable"},
    },
    tags=["Synthesis"],
)
async def synthesize_speech(
    data: Annotated[
        str,
        Form(description='JSON string: {"text":"...", "speaker":"us_female", "speed":1.0}'),
    ],
    voice_sample: Annotated[
        Optional[UploadFile],
        File(description="Optional WAV sample for voice cloning (speaker=preserve)"),
    ] = None,
    synthesis_svc: SynthesisService = Depends(get_synthesis_service),
    audio_svc: AudioService = Depends(get_audio_service),
) -> SynthesizeResponse:
    """
    TTS synthesis pipeline:
    1. Parse and validate the JSON request data
    2. (If voice cloning) Save and validate the voice sample
    3. Run XTTS-v2 synthesis in a thread pool
    4. Return the URL of the generated audio file

    Generated files are saved to the output directory and served
    as static files via GET /output/<filename>.
    """
    voice_sample_path: Optional[Path] = None

    try:
        # ── 1. Parse request JSON ─────────────────────────
        try:
            request_data = json.loads(data)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON in 'data' field: {exc}",
            )

        text: str = request_data.get("text", "").strip()
        speaker_raw: str = request_data.get("speaker", SpeakerMode.US_FEMALE.value)
        speed: float = float(request_data.get("speed", 1.0))

        if not text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="'text' field is required and cannot be empty.",
            )

        # Validate speaker mode
        try:
            speaker = SpeakerMode(speaker_raw)
        except ValueError:
            valid = [m.value for m in SpeakerMode]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid speaker '{speaker_raw}'. Must be one of: {valid}",
            )

        # Validate speed
        if not (0.5 <= speed <= 2.0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Speed must be between 0.5 and 2.0, got {speed}.",
            )

        logger.info(
            "Synthesize request | {} chars | speaker={} | speed={}",
            len(text),
            speaker.value,
            speed,
        )

        # ── 2. Handle voice sample (cloning) ─────────────
        if voice_sample is not None and voice_sample.filename:
            sample_content = await voice_sample.read()

            if len(sample_content) > MAX_SAMPLE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Voice sample too large ({len(sample_content) / 1024:.0f} KB). Max: 10 MB.",
                )

            if len(sample_content) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Voice sample file is empty.",
                )

            # Save raw sample and convert to 16kHz WAV for XTTS compatibility
            raw_sample_path = await audio_svc.save_upload(
                sample_content,
                voice_sample.filename,
            )
            try:
                voice_sample_path = await audio_svc.prepare_for_transcription(raw_sample_path)
            except AudioProcessingError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Voice sample processing failed: {exc}",
                )
            finally:
                await audio_svc.delete_file(raw_sample_path)

            logger.info("Voice sample prepared for cloning: {}", voice_sample_path)

        elif speaker == SpeakerMode.PRESERVE and voice_sample is None:
            logger.warning(
                "PRESERVE mode requested without voice sample — "
                "will fall back to US Female."
            )

        # ── 3. Synthesise audio ───────────────────────────
        try:
            result = await synthesis_svc.synthesize(
                text=text,
                speaker=speaker,
                speed=speed,
                voice_sample_path=voice_sample_path,
            )
        except SynthesisError as exc:
            logger.error("Synthesis error: {}", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Speech synthesis failed: {exc}",
            )

        logger.info(
            "✅ Synthesis done | audio_url={} | duration={:.1f}s",
            result.audio_url,
            result.duration,
        )
        return result

    finally:
        # ── Cleanup voice sample temp file ────────────────
        if voice_sample_path is not None:
            await audio_svc.delete_file(voice_sample_path)


@router.get(
    "/speakers",
    summary="List Speaker Modes",
    description="Return all available TTS speaker modes with labels and metadata.",
    tags=["Synthesis"],
)
async def get_speakers(
    synthesis_svc: SynthesisService = Depends(get_synthesis_service),
) -> dict:
    """Return speaker presets available for synthesis."""
    return {"speakers": synthesis_svc.get_available_speakers()}
