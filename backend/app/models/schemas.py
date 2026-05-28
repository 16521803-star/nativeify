"""
Nativeify Backend — Pydantic Schemas

All request/response models for the API.
These are the contracts between the frontend and backend.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# =============================================================
#  Enumerations
# =============================================================

class SpeakerMode(str, Enum):
    """Available speaker/voice modes for TTS synthesis."""
    PRESERVE = "preserve"      # Clone the user's own voice
    US_MALE = "us_male"        # Native US English male
    US_FEMALE = "us_female"    # Native US English female
    BRITISH = "british"        # British English speaker


class CorrectionStyle(str, Enum):
    """Fluency correction style for the LLM prompt."""
    NATIVE = "native"          # Natural, everyday native speaker
    FORMAL = "formal"          # Professional / business English
    CASUAL = "casual"          # Relaxed, conversational


class TTSEngine(str, Enum):
    """Available TTS backends."""
    XTTS = "xtts"
    FISH = "fish"


class PipelineStep(str, Enum):
    """Steps in the full processing pipeline."""
    TRANSCRIBE = "transcribe"
    CORRECT = "correct"
    SYNTHESIZE = "synthesize"


# =============================================================
#  Transcription
# =============================================================

class WordTimestamp(BaseModel):
    """A single word with its time range in the audio."""
    word: str
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    probability: float = Field(default=1.0, ge=0.0, le=1.0)


class TranscribeResponse(BaseModel):
    """Response from POST /transcribe."""
    text: str = Field(..., description="Full transcribed text")
    language: str = Field(..., description="Detected language code, e.g. 'en'")
    duration: float = Field(..., description="Audio duration in seconds")
    words: list[WordTimestamp] = Field(
        default_factory=list,
        description="Word-level timestamps",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "text": "Hello my name is John and I want to talk about the project.",
            "language": "en",
            "duration": 4.5,
            "words": [
                {"word": "Hello", "start": 0.0, "end": 0.4, "probability": 0.99},
            ],
        }
    }}


# =============================================================
#  Correction
# =============================================================

class DiffChunk(BaseModel):
    """
    A single chunk in a diff between original and corrected text.
    Used to render highlighted diffs in the frontend.
    """
    type: str = Field(
        ...,
        description="'equal' | 'insert' | 'delete'",
        pattern="^(equal|insert|delete)$",
    )
    text: str = Field(..., description="The text content of this chunk")


class CorrectResponse(BaseModel):
    """Response from POST /correct."""
    original: str = Field(..., description="Original input text")
    corrected: str = Field(..., description="Grammar/fluency corrected text")
    diff: list[DiffChunk] = Field(
        default_factory=list,
        description="Word-level diff between original and corrected",
    )
    changes_count: int = Field(
        default=0,
        description="Number of changed segments (inserts + deletes)",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "original": "I am go to store yesterday for buy some milk.",
            "corrected": "I went to the store yesterday to buy some milk.",
            "diff": [
                {"type": "delete", "text": "am go"},
                {"type": "insert", "text": "went"},
                {"type": "equal", "text": " to "},
                {"type": "delete", "text": "store"},
                {"type": "insert", "text": "the store"},
            ],
            "changes_count": 4,
        }
    }}


# =============================================================
#  Synthesis
# =============================================================

class SynthesizeResponse(BaseModel):
    """Response from POST /synthesize."""
    audio_url: str = Field(
        ...,
        description="Relative URL path to the generated audio file",
    )
    duration: float = Field(..., description="Generated audio duration in seconds")
    sample_rate: int = Field(..., description="Audio sample rate in Hz")

    model_config = {"json_schema_extra": {
        "example": {
            "audio_url": "/output/abc123def456.wav",
            "duration": 5.2,
            "sample_rate": 24000,
        }
    }}


# =============================================================
#  Full Pipeline
# =============================================================

class ProcessOptions(BaseModel):
    """Options for the full process-all pipeline."""
    language: str = Field(default="en", description="Transcription language hint")
    speaker: SpeakerMode = Field(
        default=SpeakerMode.US_FEMALE,
        description="Voice/speaker mode for synthesis",
    )
    style: CorrectionStyle = Field(
        default=CorrectionStyle.NATIVE,
        description="Grammar correction style",
    )
    vad_filter: bool = Field(
        default=True,
        description="Enable Voice Activity Detection filter",
    )
    speed: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="TTS speaking speed multiplier",
    )


class ProcessTimings(BaseModel):
    """Time spent in each pipeline step."""
    transcription_s: float
    correction_s: float
    synthesis_s: float
    total_s: float


class ProcessAllResponse(BaseModel):
    """Response from POST /process-all — full pipeline result."""
    transcription: TranscribeResponse
    correction: CorrectResponse
    synthesis: SynthesizeResponse
    timings: ProcessTimings

    model_config = {"json_schema_extra": {
        "example": {
            "transcription": {"text": "...", "language": "en", "duration": 4.5, "words": []},
            "correction": {"original": "...", "corrected": "...", "diff": [], "changes_count": 3},
            "synthesis": {"audio_url": "/output/abc.wav", "duration": 5.0, "sample_rate": 24000},
            "timings": {"transcription_s": 2.1, "correction_s": 3.5, "synthesis_s": 4.2, "total_s": 9.8},
        }
    }}


# =============================================================
#  Health Check
# =============================================================

class ServiceStatus(BaseModel):
    """Status of an individual service."""
    status: str = Field(..., description="'ready' | 'unavailable' | 'error'")
    detail: Optional[str] = Field(default=None, description="Additional info if not ready")


class HealthResponse(BaseModel):
    """Response from GET /health."""
    status: str = Field(..., description="Overall app status: 'ok' | 'degraded' | 'error'")
    version: str = Field(default="1.0.0")
    services: dict[str, str] = Field(
        ...,
        description="Status of each AI service",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "status": "ok",
            "version": "1.0.0",
            "services": {
                "whisper": "ready",
                "ollama": "ready",
                "tts": "ready",
                "audio": "ready",
            },
        }
    }}


# =============================================================
#  Errors
# =============================================================

class ErrorResponse(BaseModel):
    """Standard error response returned on all API errors."""
    error: str = Field(..., description="Short error type/code")
    detail: Optional[str] = Field(default=None, description="Detailed error message")
    code: int = Field(..., description="HTTP status code")

    model_config = {"json_schema_extra": {
        "example": {
            "error": "transcription_failed",
            "detail": "Audio file format not supported. Use WAV, MP3, OGG, or FLAC.",
            "code": 422,
        }
    }}


# =============================================================
#  Batch Processing
# =============================================================

class BatchItemStatus(str, Enum):
    """Status of a single item in a batch job."""
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class BatchItem(BaseModel):
    """Status of a single file in a batch job."""
    filename: str
    status: BatchItemStatus = BatchItemStatus.PENDING
    result: Optional[ProcessAllResponse] = None
    error: Optional[str] = None


class BatchResponse(BaseModel):
    """Response from a batch processing job."""
    job_id: str
    total: int
    completed: int
    items: list[BatchItem]
