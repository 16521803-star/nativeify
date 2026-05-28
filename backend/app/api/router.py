"""
Nativeify Backend — API Router

Mounts all route modules under the /api/v1 prefix.
Import this router in main.py:
    app.include_router(api_router, prefix="/api/v1")

Final route table:
  GET  /api/v1/health              — Full health check
  GET  /api/v1/health/ping         — Liveness probe
  GET  /api/v1/health/speakers     — List speaker modes

  POST /api/v1/transcribe          — Audio → text
  POST /api/v1/correct             — Text → corrected text + diff
  POST /api/v1/synthesize          — Text → audio
  GET  /api/v1/synthesize/speakers — List speaker presets
  POST /api/v1/process-all         — Audio → text → corrected → audio (full pipeline)
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import correct, health, process, synthesize, transcribe

# Root API router — all child routers are mounted here
api_router = APIRouter()

# ── Health ────────────────────────────────────────────────
# No prefix — routes are: /health, /health/ping, /health/speakers
api_router.include_router(
    health.router,
    tags=["Health"],
)

# ── Transcription ─────────────────────────────────────────
# POST /transcribe
api_router.include_router(
    transcribe.router,
    prefix="/transcribe",
    tags=["Transcription"],
)

# ── Correction ────────────────────────────────────────────
# POST /correct
api_router.include_router(
    correct.router,
    prefix="/correct",
    tags=["Correction"],
)

# ── Synthesis ─────────────────────────────────────────────
# POST /synthesize
# GET  /synthesize/speakers
api_router.include_router(
    synthesize.router,
    prefix="/synthesize",
    tags=["Synthesis"],
)

# ── Full Pipeline ─────────────────────────────────────────
# POST /process-all
api_router.include_router(
    process.router,
    prefix="/process-all",
    tags=["Pipeline"],
)
