"""
Nativeify Backend — Speech Transcription Service

Wraps faster-whisper for high-quality local speech-to-text:
  - Auto GPU/CPU device detection
  - Voice Activity Detection (VAD) filtering
  - Word-level timestamps
  - Runs synchronous inference in a thread pool (non-blocking)
  - Singleton model loaded once at startup
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

from app.core.config import Settings
from app.models.schemas import TranscribeResponse, WordTimestamp

if TYPE_CHECKING:
    from faster_whisper import WhisperModel as _WhisperModel


class TranscriptionError(Exception):
    """Raised when transcription fails."""


class TranscriptionService:
    """
    Async speech-to-text service using faster-whisper.

    The Whisper model is loaded once at init and reused for all
    subsequent transcription requests. Inference runs in a thread
    pool executor to avoid blocking the asyncio event loop.
    """

    def __init__(self, settings: Settings) -> None:
        self.model_size = settings.whisper_model_size
        self.language = settings.whisper_language
        self.device = settings.resolve_device(settings.whisper_device)
        self.compute_type = self._resolve_compute_type(
            settings.whisper_compute_type, self.device
        )
        self._model: "_WhisperModel | None" = None
        self._load_model()

    # ── Model Loading ─────────────────────────────────────

    def _resolve_compute_type(self, compute_type: str, device: str) -> str:
        """
        Ensure compute_type is compatible with the selected device.
        float16 is only supported on CUDA; fall back to int8 on CPU.
        """
        if device == "cpu" and compute_type == "float16":
            logger.info(
                "compute_type 'float16' not supported on CPU — "
                "switching to 'int8' for faster CPU inference."
            )
            return "int8"
        return compute_type

    def _load_model(self) -> None:
        """
        Load the Whisper model into memory.
        Called synchronously at startup — this is intentional since
        we want the model ready before accepting requests.
        """
        try:
            from faster_whisper import WhisperModel

            logger.info(
                "Loading Whisper '{}' on {} ({})...",
                self.model_size,
                self.device,
                self.compute_type,
            )
            t0 = time.perf_counter()
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
                # Download_root: faster-whisper caches to ~/.cache/huggingface
                # on first run and reuses on subsequent runs.
            )
            elapsed = time.perf_counter() - t0
            logger.info(
                "Whisper '{}' loaded in {:.1f}s",
                self.model_size,
                elapsed,
            )
        except Exception as exc:
            logger.error("Failed to load Whisper model: {}", exc)
            raise RuntimeError(
                f"Could not load Whisper '{self.model_size}' model: {exc}. "
                f"Check your internet connection or model path."
            ) from exc

    # ── Public API ────────────────────────────────────────

    async def transcribe(
        self,
        audio_path: str | Path,
        language: str | None = None,
        vad_filter: bool = True,
    ) -> TranscribeResponse:
        """
        Transcribe an audio file to text asynchronously.

        Args:
            audio_path:  Path to the prepared audio file (16kHz mono WAV).
            language:    Language hint (e.g. 'en'). None = auto-detect.
            vad_filter:  Enable VAD to skip silence segments (recommended).

        Returns TranscribeResponse with text, language, duration, and
        word-level timestamps.
        """
        if self._model is None:
            raise TranscriptionError("Whisper model is not loaded.")

        lang = language or self.language
        audio_path = str(audio_path)

        logger.info("Transcribing '{}' (lang={}, vad={})", audio_path, lang, vad_filter)
        t0 = time.perf_counter()

        # Run CPU-bound Whisper inference in a thread pool to avoid
        # blocking the asyncio event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._transcribe_sync,
            audio_path,
            lang,
            vad_filter,
        )

        elapsed = time.perf_counter() - t0
        logger.info(
            "Transcription complete in {:.2f}s | {} chars | lang={}",
            elapsed,
            len(result.text),
            result.language,
        )
        return result

    def _transcribe_sync(
        self,
        audio_path: str,
        language: str,
        vad_filter: bool,
    ) -> TranscribeResponse:
        """
        Synchronous transcription — runs in a thread pool executor.
        Do not call this directly from async code; use transcribe() instead.
        """
        assert self._model is not None

        try:
            segments, info = self._model.transcribe(
                audio_path,
                language=language,
                vad_filter=vad_filter,
                word_timestamps=True,           # Enable word-level timing
                vad_parameters={
                    "min_silence_duration_ms": 300,   # Ignore pauses < 300ms
                    "speech_pad_ms": 200,             # Pad speech segments
                },
                beam_size=5,                    # Beam search width
                best_of=5,
                temperature=0.0,               # Deterministic decoding
                condition_on_previous_text=True,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.6,
            )

            # Collect all segments (generator — must exhaust)
            all_words: list[WordTimestamp] = []
            full_text_parts: list[str] = []

            for segment in segments:
                full_text_parts.append(segment.text)
                if segment.words:
                    for word in segment.words:
                        all_words.append(
                            WordTimestamp(
                                word=word.word.strip(),
                                start=round(word.start, 3),
                                end=round(word.end, 3),
                                probability=round(word.probability, 4),
                            )
                        )

            full_text = " ".join(p.strip() for p in full_text_parts).strip()

            return TranscribeResponse(
                text=full_text,
                language=info.language,
                duration=round(info.duration, 3),
                words=all_words,
            )

        except Exception as exc:
            logger.error("Transcription error: {}", exc)
            raise TranscriptionError(f"Transcription failed: {exc}") from exc

    # ── Cleanup ───────────────────────────────────────────

    async def cleanup(self) -> None:
        """
        Release Whisper model from memory.
        Called during application shutdown.
        """
        if self._model is not None:
            logger.info("Releasing Whisper model from memory...")
            del self._model
            self._model = None
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    logger.debug("CUDA cache cleared")
            except ImportError:
                pass
            logger.info("Whisper model released")
