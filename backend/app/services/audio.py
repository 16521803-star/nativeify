"""
Nativeify Backend — Audio Processing Service

Wraps FFmpeg for all audio I/O operations:
  - Convert any input format → 16kHz mono WAV (for Whisper)
  - Apply spectral noise reduction
  - Extract audio metadata (duration, sample rate, channels)
  - Convert WAV → MP3 for export
  - Validate audio duration limits
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

from loguru import logger

from app.core.config import Settings


class AudioProcessingError(Exception):
    """Raised when FFmpeg or audio processing fails."""


class AudioService:
    """
    FFmpeg-based audio processing service.

    All methods are async — FFmpeg subprocesses run in asyncio
    subprocesses to avoid blocking the event loop.
    """

    def __init__(self, settings: Settings) -> None:
        self.ffmpeg = settings.ffmpeg_path
        self.output_dir = Path(settings.output_dir)
        self.max_duration = settings.max_audio_duration
        self._verify_ffmpeg()

    # ── Private: Verify FFmpeg ────────────────────────────

    def _verify_ffmpeg(self) -> None:
        """Ensure FFmpeg binary is accessible at startup."""
        if shutil.which(self.ffmpeg) is None:
            logger.warning(
                "FFmpeg not found at '{}'. Audio processing will fail. "
                "Install FFmpeg and ensure it is in your PATH.",
                self.ffmpeg,
            )
        else:
            logger.debug("FFmpeg found: {}", shutil.which(self.ffmpeg))

    # ── Private: Run FFmpeg ───────────────────────────────

    async def _run_ffmpeg(self, args: list[str]) -> tuple[str, str]:
        """
        Run FFmpeg with the given arguments asynchronously.

        Returns (stdout, stderr) on success.
        Raises AudioProcessingError on non-zero exit code.
        """
        cmd = [self.ffmpeg, "-hide_banner", "-loglevel", "error"] + args
        logger.debug("FFmpeg: {}", " ".join(cmd))

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode(errors="replace").strip()
            raise AudioProcessingError(
                f"FFmpeg failed (exit {process.returncode}): {error_msg}"
            )

        return stdout.decode(errors="replace"), stderr.decode(errors="replace")

    # ── Metadata ──────────────────────────────────────────

    async def get_metadata(self, audio_path: str | Path) -> dict[str, Any]:
        """
        Extract audio metadata using ffprobe (bundled with FFmpeg).

        Returns dict with: duration, sample_rate, channels, codec, format.
        """
        ffprobe = self.ffmpeg.replace("ffmpeg", "ffprobe")
        if shutil.which(ffprobe) is None:
            ffprobe = "ffprobe"

        cmd = [
            ffprobe,
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            str(audio_path),
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()

        if process.returncode != 0:
            raise AudioProcessingError(f"ffprobe failed on '{audio_path}'")

        info = json.loads(stdout.decode())
        fmt = info.get("format", {})
        streams = info.get("streams", [{}])
        audio_stream = next(
            (s for s in streams if s.get("codec_type") == "audio"), {}
        )

        return {
            "duration": float(fmt.get("duration", 0)),
            "sample_rate": int(audio_stream.get("sample_rate", 0)),
            "channels": int(audio_stream.get("channels", 0)),
            "codec": audio_stream.get("codec_name", "unknown"),
            "format": fmt.get("format_name", "unknown"),
            "size_bytes": int(fmt.get("size", 0)),
        }

    # ── Validation ────────────────────────────────────────

    async def validate_duration(self, audio_path: str | Path) -> float:
        """
        Check audio duration against the configured max limit.

        Returns the duration in seconds.
        Raises ValueError if duration exceeds the limit.
        """
        meta = await self.get_metadata(audio_path)
        duration = meta["duration"]

        if duration > self.max_duration:
            raise ValueError(
                f"Audio duration {duration:.1f}s exceeds the maximum "
                f"allowed {self.max_duration}s. "
                f"Please upload a shorter clip."
            )

        if duration < 0.5:
            raise ValueError(
                "Audio is too short (< 0.5s). "
                "Please record or upload a longer clip."
            )

        return duration

    # ── Conversion ────────────────────────────────────────

    async def prepare_for_transcription(self, input_path: str | Path) -> Path:
        """
        Convert any audio file to 16kHz mono PCM WAV — the format
        required by faster-whisper for optimal transcription.

        Returns the path to the processed WAV file.
        """
        input_path = Path(input_path)
        output_path = self.output_dir / f"proc_{uuid.uuid4().hex}.wav"

        await self._run_ffmpeg([
            "-i", str(input_path),
            "-ar", "16000",        # Sample rate: 16kHz
            "-ac", "1",            # Channels: mono
            "-c:a", "pcm_s16le",   # Codec: 16-bit little-endian PCM
            "-f", "wav",           # Format: WAV container
            str(output_path),
            "-y",                  # Overwrite without asking
        ])

        logger.debug(
            "Prepared audio for transcription: {} → {}",
            input_path.name,
            output_path.name,
        )
        return output_path

    async def convert_to_mp3(self, wav_path: str | Path, quality: int = 2) -> Path:
        """
        Convert a WAV file to MP3 for user export.

        Args:
            wav_path: Input WAV file path
            quality:  VBR quality 0 (best) – 9 (smallest). Default 2 ≈ 192kbps.

        Returns the path to the generated MP3 file.
        """
        wav_path = Path(wav_path)
        mp3_path = wav_path.with_suffix(".mp3")

        await self._run_ffmpeg([
            "-i", str(wav_path),
            "-codec:a", "libmp3lame",
            "-qscale:a", str(quality),
            str(mp3_path),
            "-y",
        ])

        logger.debug("Converted to MP3: {}", mp3_path.name)
        return mp3_path

    # ── Noise Reduction ───────────────────────────────────

    async def reduce_noise(self, input_path: str | Path) -> Path:
        """
        Apply FFmpeg's afftdn (Adaptive Fast Fourier Transform Denoiser)
        filter to reduce background noise.

        Best used on recordings with consistent background noise
        (fan, air conditioning, etc.).

        Returns path to denoised audio file.
        """
        input_path = Path(input_path)
        output_path = self.output_dir / f"denoised_{uuid.uuid4().hex}.wav"

        await self._run_ffmpeg([
            "-i", str(input_path),
            "-af",
            # afftdn: adaptive noise reduction
            # anlmdn: non-local means denoiser (for stronger reduction)
            "afftdn=nf=-25,anlmdn=s=7:p=0.002",
            str(output_path),
            "-y",
        ])

        logger.debug("Noise reduction applied: {}", output_path.name)
        return output_path

    # ── Normalisation ─────────────────────────────────────

    async def normalise_volume(self, input_path: str | Path) -> Path:
        """
        Normalise audio loudness to -16 LUFS (broadcast standard).
        Ensures consistent volume in generated audio.
        """
        input_path = Path(input_path)
        output_path = self.output_dir / f"norm_{uuid.uuid4().hex}.wav"

        await self._run_ffmpeg([
            "-i", str(input_path),
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            str(output_path),
            "-y",
        ])

        logger.debug("Volume normalised: {}", output_path.name)
        return output_path

    # ── Save Upload ───────────────────────────────────────

    async def save_upload(self, content: bytes, original_filename: str) -> Path:
        """
        Save raw uploaded bytes to a temp file in the output directory.

        Returns the path to the saved file, preserving the original extension.
        """
        suffix = Path(original_filename).suffix.lower() or ".wav"
        allowed = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".webm", ".aac"}

        if suffix not in allowed:
            raise ValueError(
                f"Unsupported audio format '{suffix}'. "
                f"Allowed formats: {', '.join(sorted(allowed))}"
            )

        dest = self.output_dir / f"upload_{uuid.uuid4().hex}{suffix}"
        dest.write_bytes(content)
        logger.debug("Saved upload: {} ({} bytes)", dest.name, len(content))
        return dest

    # ── Cleanup ───────────────────────────────────────────

    async def delete_file(self, path: str | Path) -> None:
        """Safely delete a temporary audio file."""
        try:
            Path(path).unlink(missing_ok=True)
            logger.debug("Deleted temp file: {}", path)
        except Exception as exc:
            logger.warning("Could not delete '{}': {}", path, exc)

    async def cleanup(self) -> None:
        """Called on shutdown — nothing to release for AudioService."""
        logger.debug("AudioService cleanup complete")
