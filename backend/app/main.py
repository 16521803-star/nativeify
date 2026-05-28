"""
Nativeify Backend — FastAPI Application Entry Point

Defines the application factory with:
- Async lifespan (startup / shutdown of AI services)
- CORS middleware for frontend communication
- Static file serving for generated audio output
- API router mounting
- Global exception handlers
"""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from app.core.config import get_settings
from app.core.logging_config import setup_logging
from app.core.dependencies import startup_services, shutdown_services
from app.models.schemas import ErrorResponse


# =============================================================
#  Application Lifespan
# =============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage startup and shutdown of all AI services.
    FastAPI calls this once on start and teardown.
    """
    settings = get_settings()

    # ── Startup ───────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("🎙️  Nativeify v1.0.0 — Starting up")
    logger.info("=" * 60)

    # Ensure output directory exists
    Path(settings.output_dir).mkdir(parents=True, exist_ok=True)
    logger.info("Output directory: {}", settings.output_dir)

    # Load all AI models into memory
    await startup_services()

    logger.info("=" * 60)
    logger.info("✅ All services ready — listening on port {}", settings.backend_port)
    logger.info("📖 API docs: http://localhost:{}/docs", settings.backend_port)
    logger.info("=" * 60)

    yield  # App is running

    # ── Shutdown ──────────────────────────────────────────
    logger.info("🛑 Nativeify shutting down...")
    await shutdown_services()
    logger.info("Goodbye! 👋")


# =============================================================
#  Application Factory
# =============================================================

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    # Setup logging before anything else
    setup_logging(settings.log_level)

    app = FastAPI(
        title="Nativeify API",
        description=(
            "Local AI pipeline: English speech → native-level English audio.\n\n"
            "All processing runs locally — no cloud dependencies."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # ── CORS Middleware ───────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],  # For file download headers
    )

    # ── Request Timing Middleware ─────────────────────────
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        """Log request duration and add X-Process-Time header."""
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        response.headers["X-Process-Time"] = f"{duration:.4f}s"
        if request.url.path.startswith("/api"):
            logger.debug(
                "{} {} → {} ({:.0f}ms)",
                request.method,
                request.url.path,
                response.status_code,
                duration * 1000,
            )
        return response

    # ── Static Files (generated audio) ───────────────────
    output_dir = Path(settings.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    app.mount(
        "/output",
        StaticFiles(directory=str(output_dir)),
        name="output",
    )

    # ── API Routes ────────────────────────────────────────
    from app.api.router import api_router
    app.include_router(api_router, prefix="/api/v1")

    # ── Global Exception Handlers ─────────────────────────
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        logger.warning("Validation error on {}: {}", request.url.path, str(exc))
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error="validation_error",
                detail=str(exc),
                code=422,
            ).model_dump(),
        )

    @app.exception_handler(RuntimeError)
    async def runtime_error_handler(request: Request, exc: RuntimeError):
        logger.error("Runtime error on {}: {}", request.url.path, str(exc))
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error="internal_error",
                detail=str(exc),
                code=500,
            ).model_dump(),
        )

    @app.exception_handler(FileNotFoundError)
    async def file_not_found_handler(request: Request, exc: FileNotFoundError):
        logger.warning("File not found on {}: {}", request.url.path, str(exc))
        return JSONResponse(
            status_code=404,
            content=ErrorResponse(
                error="file_not_found",
                detail=str(exc),
                code=404,
            ).model_dump(),
        )

    # ── Root Health Ping ──────────────────────────────────
    @app.get("/", include_in_schema=False)
    async def root():
        """Quick ping to verify the server is alive."""
        return {"message": "Nativeify API is running", "docs": "/docs"}

    return app


# =============================================================
#  Application Instance
# =============================================================

app = create_app()
