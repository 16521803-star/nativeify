"""
Nativeify Backend — Grammar & Fluency Correction Service

Uses Ollama (local LLM) to:
  - Fix grammar and spelling errors
  - Improve fluency to sound like a native English speaker
  - Preserve the original meaning exactly
  - Generate a word-level diff between original and corrected text

Prompt engineering is carefully designed to prevent the LLM from
adding explanations, changing tone unnecessarily, or hallucinating.
"""

from __future__ import annotations

import time
from typing import Literal

import httpx
from loguru import logger

from app.core.config import Settings
from app.models.schemas import CorrectResponse, CorrectionStyle, DiffChunk


# =============================================================
#  Prompt Templates
# =============================================================

# System prompt — instructs the LLM on its exact task
_SYSTEM_PROMPT = """You are a professional English language editor specialising in making non-native speaker text sound completely natural and fluent.

Your task:
1. Fix ALL grammar, spelling, punctuation, and syntax errors
2. Make the text sound natural and fluent — exactly how a native English speaker would say it
3. Preserve the ORIGINAL MEANING completely — do not add, remove, or change any ideas
4. Keep the same approximate length and formality level as the input
5. Return ONLY the corrected text — no explanations, no comments, no preamble

Style guide:
- NATIVE: Conversational, natural, everyday English
- FORMAL: Professional, precise, suitable for business or academic contexts
- CASUAL: Relaxed, friendly, informal but still correct

CRITICAL: Output ONLY the corrected sentence(s). Nothing else."""

_USER_PROMPT_TEMPLATE = """Style: {style}

Original text:
{text}

Corrected text:"""


class CorrectionError(Exception):
    """Raised when grammar correction fails."""


class OllamaConnectionError(CorrectionError):
    """Raised when Ollama server is unreachable."""


class CorrectionService:
    """
    Async grammar and fluency correction service using Ollama.

    Communicates with the local Ollama REST API to run inference
    using a locally stored LLM (default: llama3.2:3b).
    """

    def __init__(self, settings: Settings) -> None:
        self.ollama_host = settings.ollama_host.rstrip("/")
        self.model = settings.ollama_model
        self.timeout = settings.ollama_timeout

    # ── Connection Verification ───────────────────────────

    async def verify_connection(self) -> None:
        """
        Verify that Ollama is running and the configured model is available.
        Called once at startup; logs a warning (not fatal) if unavailable.
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_host}/api/tags")
                response.raise_for_status()

            models = response.json().get("models", [])
            model_names = [m.get("name", "") for m in models]

            # Check if our model is available (name may include tag)
            model_base = self.model.split(":")[0]
            available = any(
                m.startswith(model_base) or m.startswith(self.model)
                for m in model_names
            )

            if available:
                logger.info(
                    "Ollama connected | model '{}' is available ✓",
                    self.model,
                )
            else:
                logger.warning(
                    "Ollama is running but model '{}' not found. "
                    "Run: ollama pull {}",
                    self.model,
                    self.model,
                )

        except httpx.ConnectError:
            logger.warning(
                "Cannot connect to Ollama at {}. "
                "Grammar correction will fail until Ollama is started. "
                "Run: ollama serve",
                self.ollama_host,
            )
        except Exception as exc:
            logger.warning("Ollama check failed: {}", exc)

    # ── Public API ────────────────────────────────────────

    async def correct(
        self,
        text: str,
        style: CorrectionStyle = CorrectionStyle.NATIVE,
    ) -> CorrectResponse:
        """
        Grammar-correct and fluency-improve the input text.

        Args:
            text:   The raw transcribed text to correct.
            style:  Correction style (native / formal / casual).

        Returns CorrectResponse with original, corrected text, diff, and
        count of changes.
        """
        if not text.strip():
            raise ValueError("Input text is empty — nothing to correct.")

        logger.info("Correcting text ({} chars, style={})", len(text), style.value)
        t0 = time.perf_counter()

        corrected = await self._call_ollama(text, style)
        diff = self._generate_diff(text, corrected)
        changes = sum(1 for chunk in diff if chunk.type in ("insert", "delete"))

        elapsed = time.perf_counter() - t0
        logger.info(
            "Correction complete in {:.2f}s | {} changes",
            elapsed,
            changes,
        )

        return CorrectResponse(
            original=text,
            corrected=corrected,
            diff=diff,
            changes_count=changes,
        )

    # ── Ollama Client ─────────────────────────────────────

    async def _call_ollama(self, text: str, style: CorrectionStyle) -> str:
        """
        Send a prompt to Ollama and return the corrected text.

        Uses the /api/generate endpoint with streaming disabled
        for simplicity and reliability.
        """
        prompt = _USER_PROMPT_TEMPLATE.format(
            style=style.value.upper(),
            text=text,
        )

        payload = {
            "model": self.model,
            "system": _SYSTEM_PROMPT,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,      # Low temp = consistent, less creative
                "top_p": 0.9,
                "top_k": 40,
                "num_predict": 1024,     # Max tokens to generate
                "stop": ["\n\n", "---"], # Stop at double newline
            },
        }

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout, connect=5.0)
            ) as client:
                logger.debug("Sending request to Ollama model '{}'...", self.model)
                response = await client.post(
                    f"{self.ollama_host}/api/generate",
                    json=payload,
                )
                response.raise_for_status()

        except httpx.ConnectError as exc:
            raise OllamaConnectionError(
                f"Cannot connect to Ollama at {self.ollama_host}. "
                f"Make sure Ollama is running: 'ollama serve'"
            ) from exc
        except httpx.TimeoutException as exc:
            raise CorrectionError(
                f"Ollama request timed out after {self.timeout}s. "
                f"Try a smaller model or increase OLLAMA_TIMEOUT."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise CorrectionError(
                f"Ollama returned HTTP {exc.response.status_code}: "
                f"{exc.response.text[:200]}"
            ) from exc

        data = response.json()
        raw_response: str = data.get("response", "").strip()

        if not raw_response:
            logger.warning("Ollama returned empty response — returning original text")
            return text

        # Strip any accidental explanation the LLM might have added
        corrected = self._clean_llm_output(raw_response, text)
        return corrected

    # ── Output Cleaning ───────────────────────────────────

    def _clean_llm_output(self, llm_output: str, original: str) -> str:
        """
        Post-process LLM output to remove accidental prefixes/explanations.

        Despite our prompt, some models occasionally add phrases like
        "Corrected text:" or "Here is the corrected version:".
        This strips those out.
        """
        # Strip common prefixes the LLM might add
        prefixes_to_strip = [
            "corrected text:",
            "corrected version:",
            "here is the corrected text:",
            "here's the corrected text:",
            "corrected:",
            "output:",
        ]
        output = llm_output
        for prefix in prefixes_to_strip:
            if output.lower().startswith(prefix):
                output = output[len(prefix):].lstrip()
                break

        # If output is suspiciously short (< 20% of original), fallback
        if len(output) < len(original) * 0.2:
            logger.warning(
                "LLM output too short ({} vs {} chars) — using original",
                len(output),
                len(original),
            )
            return original

        return output.strip()

    # ── Diff Generation ───────────────────────────────────

    def _generate_diff(self, original: str, corrected: str) -> list[DiffChunk]:
        """
        Generate a word-level diff between original and corrected text.

        Uses Google's diff-match-patch library for accurate diffs.
        Returns a list of DiffChunk objects (equal / insert / delete).
        """
        try:
            from diff_match_patch import diff_match_patch  # type: ignore

            dmp = diff_match_patch()

            # Compute character-level diff
            diffs = dmp.diff_main(original, corrected)
            dmp.diff_cleanupSemantic(diffs)  # Improve human readability

            # Map diff-match-patch operation codes to our schema
            op_map = {
                -1: "delete",
                0: "equal",
                1: "insert",
            }

            chunks: list[DiffChunk] = []
            for op, text in diffs:
                if text:  # Skip empty chunks
                    chunks.append(
                        DiffChunk(type=op_map[op], text=text)
                    )

            return chunks

        except ImportError:
            logger.warning(
                "diff-match-patch not installed — returning simple diff. "
                "Install with: pip install diff-match-patch"
            )
            # Fallback: return the two texts as delete + insert
            if original == corrected:
                return [DiffChunk(type="equal", text=original)]
            return [
                DiffChunk(type="delete", text=original),
                DiffChunk(type="insert", text=corrected),
            ]
        except Exception as exc:
            logger.error("Diff generation failed: {}", exc)
            return [DiffChunk(type="equal", text=corrected)]
