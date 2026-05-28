"""
Nativeify Backend — Logging Configuration

Sets up structured console + file logging using Loguru.
Call setup_logging() once at application startup.
"""

from __future__ import annotations

import sys
from pathlib import Path

from loguru import logger


def setup_logging(log_level: str = "info") -> None:
    """
    Configure Loguru with:
    - Coloured console output (stderr)
    - Rotating file handler in ./logs/nativeify.log
    - Structured format with timestamp, level, module, and message
    """
    # Remove the default Loguru handler
    logger.remove()

    # ── Console Handler ───────────────────────────────────
    console_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> "
        "— <level>{message}</level>"
    )
    logger.add(
        sys.stderr,
        level=log_level.upper(),
        format=console_format,
        colorize=True,
        backtrace=True,
        diagnose=True,
    )

    # ── File Handler ──────────────────────────────────────
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    file_format = (
        "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
        "{level: <8} | "
        "{name}:{function}:{line} — {message}"
    )
    logger.add(
        log_dir / "nativeify.log",
        level="DEBUG",               # Always log everything to file
        format=file_format,
        rotation="10 MB",            # New file when current hits 10 MB
        retention="7 days",          # Keep logs for 7 days
        compression="zip",           # Compress rotated files
        backtrace=True,
        diagnose=True,
        enqueue=True,                # Thread-safe async logging
    )

    logger.info(
        "Logging configured | level={} | log_file=logs/nativeify.log",
        log_level.upper(),
    )


def get_logger(name: str):
    """
    Return a named logger bound with context.
    Usage:
        log = get_logger(__name__)
        log.info("Service started")
    """
    return logger.bind(name=name)
