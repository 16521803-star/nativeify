"""
Nativeify Backend — Service Dependencies & Lifecycle

Manages singleton instances of all AI services.
Services are initialised at startup and injected into route handlers
via FastAPI's dependency injection system.

Lifecycle:
  startup_services()  — called by FastAPI lifespan on startup
  shutdown_services() — called by FastAPI lifespan on shutdown
  get_*_service()     — FastAPI Depends() injectors for routes
"""

from __future__ import annotations

from loguru import logger
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.transcription import TranscriptionService
    from app.services.correction import CorrectionService
    from app.services.synthesis import SynthesisService
    from app.services.audio import AudioService


# ── Global service singletons ─────────────────────────────
# These are populated during startup and reused for every request.
_transcription_service: "TranscriptionService | None" = None
_correction_service: "CorrectionService | None" = None
_synthesis_service: "SynthesisService | None" = None
_audio_service: "AudioService | None" = None


async def startup_services() -> None:
    """
    Initialise all AI services at application startup.
    Heavy models (Whisper, XTTS) are loaded into memory here.
    This runs once when the FastAPI app starts.
    """
    global _transcription_service, _correction_service
    global _synthesis_service, _audio_service

    from app.core.config import get_settings
    from app.services.transcription import TranscriptionService
    from app.services.correction import CorrectionService
    from app.services.synthesis import SynthesisService
    from app.services.audio import AudioService

    settings = get_settings()

    # ── Audio service (no heavy model, init first) ────────
    logger.info("Initialising AudioService...")
    _audio_service = AudioService(settings)
    logger.info("✅ AudioService ready")

    # ── Transcription (loads Whisper model) ───────────────
    logger.info(
        "Loading Whisper '{}' model — this may take a moment...",
        settings.whisper_model_size,
    )
    _transcription_service = TranscriptionService(settings)
    logger.info("✅ TranscriptionService ready (Whisper loaded)")

    # ── Correction (validates Ollama connection) ──────────
    logger.info("Initialising CorrectionService (Ollama: {})...", settings.ollama_host)
    _correction_service = CorrectionService(settings)
    await _correction_service.verify_connection()
    logger.info("✅ CorrectionService ready")

    # ── Synthesis (loads TTS model — heaviest step) ───────
    logger.info(
        "Loading TTS engine '{}' — this may take several minutes on first run...",
        settings.tts_engine,
    )
    _synthesis_service = SynthesisService(settings)
    logger.info("✅ SynthesisService ready")


async def shutdown_services() -> None:
    """
    Clean up resources on application shutdown.
    Releases GPU memory and closes connections.
    """
    global _transcription_service, _correction_service
    global _synthesis_service, _audio_service

    logger.info("Releasing service resources...")

    if _synthesis_service is not None:
        await _synthesis_service.cleanup()

    if _transcription_service is not None:
        await _transcription_service.cleanup()

    _transcription_service = None
    _correction_service = None
    _synthesis_service = None
    _audio_service = None

    logger.info("✅ All services shut down cleanly")


# ── FastAPI Dependency Injectors ──────────────────────────
# Use these in route handlers with Depends():
#   async def my_route(svc: TranscriptionService = Depends(get_transcription_service)):

def get_transcription_service() -> "TranscriptionService":
    """Inject the TranscriptionService singleton."""
    if _transcription_service is None:
        raise RuntimeError(
            "TranscriptionService not initialised. "
            "Ensure startup_services() ran successfully."
        )
    return _transcription_service


def get_correction_service() -> "CorrectionService":
    """Inject the CorrectionService singleton."""
    if _correction_service is None:
        raise RuntimeError(
            "CorrectionService not initialised. "
            "Ensure startup_services() ran successfully."
        )
    return _correction_service


def get_synthesis_service() -> "SynthesisService":
    """Inject the SynthesisService singleton."""
    if _synthesis_service is None:
        raise RuntimeError(
            "SynthesisService not initialised. "
            "Ensure startup_services() ran successfully."
        )
    return _synthesis_service


def get_audio_service() -> "AudioService":
    """Inject the AudioService singleton."""
    if _audio_service is None:
        raise RuntimeError(
            "AudioService not initialised. "
            "Ensure startup_services() ran successfully."
        )
    return _audio_service


def get_service_status() -> dict[str, str]:
    """
    Return a health snapshot of all services.
    Used by the /health endpoint.
    """
    def _status(svc: object) -> str:
        return "ready" if svc is not None else "unavailable"

    return {
        "whisper": _status(_transcription_service),
        "ollama": _status(_correction_service),
        "tts": _status(_synthesis_service),
        "audio": _status(_audio_service),
    }
