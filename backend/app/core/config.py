"""
Nativeify Backend — Application Configuration

Uses Pydantic Settings to load config from environment variables
and .env file. Cached with lru_cache for singleton access.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central configuration for the Nativeify backend.

    All fields can be overridden via environment variables or .env file.
    Environment variable names match field names (case-insensitive).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",        # Ignore unknown env vars
    )

    # ── Backend Server ────────────────────────────────────
    backend_host: str = Field(default="0.0.0.0", description="Host to bind the server to")
    backend_port: int = Field(default=8000, ge=1024, le=65535, description="Port to listen on")
    backend_reload: bool = Field(default=False, description="Enable hot-reload (dev only)")
    log_level: str = Field(default="info", description="Logging level: debug|info|warning|error")

    # ── Whisper STT ───────────────────────────────────────
    whisper_model_size: str = Field(
        default="medium",
        description="Whisper model: tiny|base|small|medium|large-v2|large-v3",
    )
    whisper_device: str = Field(
        default="auto",
        description="Inference device: auto|cpu|cuda",
    )
    whisper_compute_type: str = Field(
        default="float16",
        description="Compute precision: float16|int8|float32",
    )
    whisper_language: str = Field(
        default="en",
        description="Language hint for transcription",
    )

    # ── Ollama LLM ────────────────────────────────────────
    ollama_host: str = Field(
        default="http://localhost:11434",
        description="Ollama API base URL",
    )
    ollama_model: str = Field(
        default="llama3.2:3b",
        description="Ollama model name to use for grammar correction",
    )
    ollama_timeout: int = Field(
        default=60,
        ge=5,
        description="HTTP request timeout for Ollama (seconds)",
    )

    # ── TTS Engine ────────────────────────────────────────
    tts_engine: str = Field(
        default="xtts",
        description="TTS backend: xtts|fish",
    )
    xtts_model_path: Path = Field(
        default=Path("./models/xtts"),
        description="Directory for XTTS-v2 model files",
    )
    fish_model_path: Path = Field(
        default=Path("./models/fish"),
        description="Directory for Fish Speech model files",
    )
    tts_device: str = Field(
        default="auto",
        description="TTS inference device: auto|cpu|cuda",
    )

    # ── Audio Processing ──────────────────────────────────
    ffmpeg_path: str = Field(
        default="ffmpeg",
        description="Path to ffmpeg binary (or just 'ffmpeg' if in PATH)",
    )
    output_dir: Path = Field(
        default=Path("./output"),
        description="Directory where generated audio files are saved",
    )
    max_audio_duration: int = Field(
        default=300,
        ge=10,
        le=3600,
        description="Maximum allowed audio input length in seconds",
    )

    # ── CORS ──────────────────────────────────────────────
    allowed_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="List of allowed CORS origins",
    )

    # ── Validators ────────────────────────────────────────
    @field_validator("whisper_model_size")
    @classmethod
    def validate_whisper_model(cls, v: str) -> str:
        valid = {"tiny", "base", "small", "medium", "large-v2", "large-v3"}
        if v not in valid:
            raise ValueError(f"whisper_model_size must be one of {valid}, got '{v}'")
        return v

    @field_validator("whisper_device", "tts_device")
    @classmethod
    def validate_device(cls, v: str) -> str:
        valid = {"auto", "cpu", "cuda"}
        if v not in valid:
            raise ValueError(f"Device must be one of {valid}, got '{v}'")
        return v

    @field_validator("tts_engine")
    @classmethod
    def validate_tts_engine(cls, v: str) -> str:
        valid = {"xtts", "fish"}
        if v not in valid:
            raise ValueError(f"tts_engine must be one of {valid}, got '{v}'")
        return v

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid = {"debug", "info", "warning", "error", "critical"}
        v_lower = v.lower()
        if v_lower not in valid:
            raise ValueError(f"log_level must be one of {valid}, got '{v}'")
        return v_lower

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: object) -> list[str]:
        """Allow comma-separated string from env var."""
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v  # type: ignore[return-value]

    def resolve_device(self, preferred: str) -> str:
        """
        Resolve 'auto' device selection to 'cuda' or 'cpu'
        based on PyTorch CUDA availability.
        """
        if preferred != "auto":
            return preferred
        try:
            import torch
            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the cached Settings singleton.
    Call this from anywhere to access configuration.
    """
    return Settings()
