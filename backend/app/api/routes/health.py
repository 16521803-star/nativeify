"""
Nativeify Backend — Health Check Route

GET /api/v1/health
  Returns status of all AI services plus system info.

GET /api/v1/health/ping
  Minimal liveness probe — returns instantly with no service checks.
"""

from __future__ import annotations

import platform
import sys
import time

from fastapi import APIRouter
from loguru import logger

from app.core.dependencies import get_service_status
from app.models.schemas import HealthResponse

router = APIRouter()

# Record startup time for uptime reporting
_START_TIME = time.time()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Health Check",
    description=(
        "Returns the operational status of all AI services "
        "(Whisper, Ollama, TTS, FFmpeg). "
        "Use this to verify the backend is fully ready before sending requests."
    ),
    tags=["Health"],
)
async def health_check() -> HealthResponse:
    """
    Full health check — queries all service statuses.

    Returns:
        - **status**: `ok` if all services ready, `degraded` if some unavailable
        - **services**: per-service status dict
        - **version**: API version string
    """
    statuses = get_service_status()

    # Overall status: ok only if all services are ready
    all_ready = all(v == "ready" for v in statuses.values())
    overall = "ok" if all_ready else "degraded"

    if not all_ready:
        unavailable = [k for k, v in statuses.items() if v != "ready"]
        logger.warning("Health check: degraded — unavailable: {}", unavailable)

    return HealthResponse(
        status=overall,
        version="1.0.0",
        services=statuses,
    )


@router.get(
    "/health/ping",
    summary="Liveness Probe",
    description="Minimal ping — returns instantly. Use for load balancer / Docker health checks.",
    tags=["Health"],
)
async def ping() -> dict:
    """Lightweight liveness check with no service introspection."""
    uptime_s = int(time.time() - _START_TIME)
    return {
        "status": "alive",
        "uptime_seconds": uptime_s,
        "python": sys.version.split()[0],
        "platform": platform.system(),
    }


@router.get(
    "/health/speakers",
    summary="Available Speakers",
    description="List available TTS speaker modes and their metadata.",
    tags=["Health"],
)
async def list_speakers() -> dict:
    """
    Returns available speaker modes for the frontend VoiceSelector.
    Does not require TTS model to be loaded.
    """
    from app.models.schemas import SpeakerMode

    speakers = [
        {
            "mode": SpeakerMode.PRESERVE.value,
            "label": "Preserve My Voice",
            "description": "Clone your voice from your recorded sample",
            "icon": "🎤",
            "requires_sample": True,
        },
        {
            "mode": SpeakerMode.US_MALE.value,
            "label": "US Male",
            "description": "Clear, natural American English male",
            "icon": "🇺🇸",
            "requires_sample": False,
        },
        {
            "mode": SpeakerMode.US_FEMALE.value,
            "label": "US Female",
            "description": "Natural, warm American English female",
            "icon": "🇺🇸",
            "requires_sample": False,
        },
        {
            "mode": SpeakerMode.BRITISH.value,
            "label": "British",
            "description": "Refined British English accent",
            "icon": "🇬🇧",
            "requires_sample": False,
        },
    ]
    return {"speakers": speakers}
