"""
Nativeify Backend — Text-to-Speech Synthesis Service

Supports two TTS backends:
  - XTTS-v2 (default): High-quality multilingual TTS with voice cloning
  - Fish Speech: Lightweight alternative for low-resource environments

Speaker presets map SpeakerMode enum values to XTTS built-in speakers.
Voice cloning uses a short (~6 second) WAV sample from the user.

Inference is run in a thread pool executor (non-blocking).
The TTS model is loaded once at init and reused for all requests.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

from app.core.config import Settings
from app.models.schemas import SpeakerMode, SynthesizeResponse

if TYPE_CHECKING:
    pass


# =============================================================
#  Speaker Presets — XTTS-v2 Built-in Voices
# =============================================================

# XTTS-v2 ships with a set of built-in speaker reference embeddings.
# These names map directly to speakers available in the XTTS-v2 model.
XTTS_SPEAKER_MAP: dict[SpeakerMode, str] = {
    SpeakerMode.US_MALE: "Aaron Dreschner",       # Clear US male voice
    SpeakerMode.US_FEMALE: "Claribel Dervla",     # Natural US female voice
    SpeakerMode.BRITISH: "Viktor Eka",             # Closest British-accented voice
}


class SynthesisError(Exception):
    """Raised when TTS synthesis fails."""


class SynthesisService:
    """
    Async text-to-speech synthesis service.

    Supports XTTS-v2 (recommended) and Fish Speech backends.
    The selected engine is loaded once at init.
    """

    def __init__(self, settings: Settings) -> None:
        self.engine = settings.tts_engine
        self.device = settings.resolve_device(settings.tts_device)
        self.output_dir = Path(settings.output_dir)
        self.xtts_model_path = settings.xtts_model_path
        self._tts = None  # Lazy — set by _load_*

        self._load_engine()

    # ── Engine Loading ────────────────────────────────────

    def _load_engine(self) -> None:
        """Load the selected TTS engine at startup."""
        if self.engine == "xtts":
            self._load_xtts()
        elif self.engine == "fish":
            self._load_fish()
        else:
            raise ValueError(f"Unknown TTS engine: '{self.engine}'")

    def _load_xtts(self) -> None:
        """
        Load XTTS-v2 via the Coqui TTS library.

        On first run, this downloads the model (~1.8 GB) to the
        default Coqui cache directory. Subsequent runs load from cache.
        """
        try:
            from TTS.api import TTS  # type: ignore

            logger.info("Loading XTTS-v2 model on {}...", self.device)
            t0 = time.perf_counter()

            # Use GPU if available — significantly faster synthesis
            use_gpu = self.device == "cuda"

            self._tts = TTS(
                model_name="tts_models/multilingual/multi-dataset/xtts_v2",
                gpu=use_gpu,
            )

            elapsed = time.perf_counter() - t0
            logger.info("XTTS-v2 loaded in {:.1f}s (gpu={})", elapsed, use_gpu)

        except ImportError as exc:
            raise RuntimeError(
                "Coqui TTS library not installed. "
                "Run: pip install TTS"
            ) from exc
        except Exception as exc:
            logger.error("Failed to load XTTS-v2: {}", exc)
            raise RuntimeError(
                f"XTTS-v2 model failed to load: {exc}. "
                f"Check your internet connection for the first-run download."
            ) from exc

    def _load_fish(self) -> None:
        """
        Placeholder for Fish Speech backend loading.
        Fish Speech integration requires the fish-speech package.
        """
        logger.warning(
            "Fish Speech backend selected but not fully implemented. "
            "Falling back to a basic TTS fallback. "
            "Install fish-speech for full support."
        )
        # Attempt to load TTS library with a lightweight model as fallback
        try:
            from TTS.api import TTS  # type: ignore
            self._tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC")
            logger.info("Fish Speech fallback: loaded LJSpeech Tacotron2")
        except Exception as exc:
            logger.error("Fallback TTS load failed: {}", exc)
            self._tts = None

    # ── Public API ────────────────────────────────────────

    async def synthesize(
        self,
        text: str,
        speaker: SpeakerMode = SpeakerMode.US_FEMALE,
        speed: float = 1.0,
        voice_sample_path: str | Path | None = None,
    ) -> SynthesizeResponse:
        """
        Synthesise speech from text.

        Args:
            text:              Text to speak. Should be clean, corrected text.
            speaker:           SpeakerMode enum value.
            speed:             Speaking speed multiplier (0.5 – 2.0).
            voice_sample_path: Path to a WAV file for voice cloning
                               (used when speaker=PRESERVE).

        Returns SynthesizeResponse with the audio file URL, duration,
        and sample rate.
        """
        if not text.strip():
            raise ValueError("Cannot synthesise empty text.")

        if self._tts is None:
            raise SynthesisError("TTS model is not loaded.")

        output_path = self.output_dir / f"synth_{uuid.uuid4().hex}.wav"

        logger.info(
            "Synthesising {} chars | speaker={} | speed={}",
            len(text),
            speaker.value,
            speed,
        )
        t0 = time.perf_counter()

        # Run CPU/GPU-bound TTS inference in a thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._synthesize_sync,
            text,
            speaker,
            speed,
            voice_sample_path,
            output_path,
        )

        elapsed = time.perf_counter() - t0
        duration = await self._get_audio_duration(output_path)

        logger.info(
            "Synthesis complete in {:.2f}s | output: {} | {:.1f}s audio",
            elapsed,
            output_path.name,
            duration,
        )

        return SynthesizeResponse(
            audio_url=f"/output/{output_path.name}",
            duration=round(duration, 3),
            sample_rate=24000,  # XTTS-v2 always outputs 24kHz
        )

    def _synthesize_sync(
        self,
        text: str,
        speaker: SpeakerMode,
        speed: float,
        voice_sample_path: str | Path | None,
        output_path: Path,
    ) -> None:
        """
        Synchronous TTS synthesis — runs in a thread pool executor.
        Do not call this directly from async code.
        """
        assert self._tts is not None

        try:
            if self.engine == "xtts":
                self._synthesize_xtts(text, speaker, speed, voice_sample_path, output_path)
            else:
                self._synthesize_fish(text, output_path)
        except Exception as exc:
            logger.error("Synthesis failed: {}", exc)
            raise SynthesisError(f"TTS synthesis failed: {exc}") from exc

    def _synthesize_xtts(
        self,
        text: str,
        speaker: SpeakerMode,
        speed: float,
        voice_sample_path: str | Path | None,
        output_path: Path,
    ) -> None:
        """
        XTTS-v2 synthesis logic.

        Two modes:
        1. Voice cloning (PRESERVE): Use the user's voice sample as reference.
        2. Built-in speaker: Use one of the XTTS-v2 preset speaker embeddings.
        """
        if speaker == SpeakerMode.PRESERVE and voice_sample_path:
            # ── Voice Cloning Mode ────────────────────────
            logger.debug("Voice cloning from sample: {}", voice_sample_path)
            self._tts.tts_to_file(
                text=text,
                file_path=str(output_path),
                speaker_wav=str(voice_sample_path),
                language="en",
                speed=speed,
            )
        elif speaker == SpeakerMode.PRESERVE and not voice_sample_path:
            # No sample provided — fall back to US Female
            logger.warning(
                "PRESERVE mode requested but no voice sample provided. "
                "Falling back to US Female speaker."
            )
            self._tts.tts_to_file(
                text=text,
                file_path=str(output_path),
                speaker=XTTS_SPEAKER_MAP[SpeakerMode.US_FEMALE],
                language="en",
                speed=speed,
            )
        else:
            # ── Built-in Speaker Mode ─────────────────────
            speaker_name = XTTS_SPEAKER_MAP.get(speaker, XTTS_SPEAKER_MAP[SpeakerMode.US_FEMALE])
            logger.debug("Using built-in XTTS speaker: '{}'", speaker_name)
            self._tts.tts_to_file(
                text=text,
                file_path=str(output_path),
                speaker=speaker_name,
                language="en",
                speed=speed,
            )

    def _synthesize_fish(self, text: str, output_path: Path) -> None:
        """
        Fish Speech synthesis (basic fallback using Tacotron2).
        Full Fish Speech integration is a future enhancement.
        """
        if self._tts is not None:
            self._tts.tts_to_file(text=text, file_path=str(output_path))
        else:
            raise SynthesisError(
                "No TTS model available. "
                "Check TTS_ENGINE setting and model installation."
            )

    # ── Utilities ─────────────────────────────────────────

    async def _get_audio_duration(self, path: Path) -> float:
        """
        Read the duration of a WAV file without loading it fully.
        Uses soundfile for accuracy.
        """
        try:
            import soundfile as sf  # type: ignore
            loop = asyncio.get_event_loop()
            info = await loop.run_in_executor(None, sf.info, str(path))
            return info.duration
        except Exception:
            # Fallback: estimate from file size (PCM 24kHz mono 16-bit)
            size = path.stat().st_size
            # bytes / (sample_rate * channels * bytes_per_sample)
            return size / (24000 * 1 * 2)

    def get_available_speakers(self) -> list[dict]:
        """
        Return metadata about available speaker modes.
        Used by the /health or /speakers endpoint for the frontend.
        """
        return [
            {
                "mode": SpeakerMode.PRESERVE.value,
                "label": "Preserve Your Voice",
                "description": "Clone your own voice from a sample recording",
                "requires_sample": True,
            },
            {
                "mode": SpeakerMode.US_MALE.value,
                "label": "US Male",
                "description": "Clear American English male voice",
                "requires_sample": False,
            },
            {
                "mode": SpeakerMode.US_FEMALE.value,
                "label": "US Female",
                "description": "Natural American English female voice",
                "requires_sample": False,
            },
            {
                "mode": SpeakerMode.BRITISH.value,
                "label": "British",
                "description": "British English accent",
                "requires_sample": False,
            },
        ]

    # ── Cleanup ───────────────────────────────────────────

    async def cleanup(self) -> None:
        """
        Release TTS model from memory.
        Called during application shutdown.
        """
        if self._tts is not None:
            logger.info("Releasing TTS model from memory...")
            del self._tts
            self._tts = None
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    logger.debug("CUDA cache cleared (TTS)")
            except ImportError:
                pass
            logger.info("TTS model released")
