"""
Nativeify Backend — Grammar Correction Route

POST /api/v1/correct
  Accepts raw transcribed text and returns the grammar/fluency-corrected
  version along with a word-level diff for highlighting in the UI.

  JSON body:
    text  : str            — the text to correct
    style : str            — "native" | "formal" | "casual"  (default: "native")
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel, Field

from app.core.dependencies import get_correction_service
from app.models.schemas import CorrectResponse, CorrectionStyle, ErrorResponse
from app.services.correction import (
    CorrectionError,
    CorrectionService,
    OllamaConnectionError,
)

router = APIRouter()


# ── Request Model ─────────────────────────────────────────

class CorrectRequest(BaseModel):
    """Request body for POST /correct."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="The transcribed text to grammar-correct and improve",
        examples=["I am go to store yesterday for buy some milk."],
    )
    style: CorrectionStyle = Field(
        default=CorrectionStyle.NATIVE,
        description="Correction style: native | formal | casual",
    )


# ── Route ─────────────────────────────────────────────────

@router.post(
    "",
    response_model=CorrectResponse,
    status_code=status.HTTP_200_OK,
    summary="Correct Grammar & Improve Fluency",
    description=(
        "Send transcribed English text and receive the corrected, "
        "fluent version along with a character-level diff. "
        "Uses a local LLM (Ollama) for correction — no internet required."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Empty or invalid text"},
        500: {"model": ErrorResponse, "description": "LLM correction failed"},
        503: {"model": ErrorResponse, "description": "Ollama service unavailable"},
    },
    tags=["Correction"],
)
async def correct_text(
    request: CorrectRequest,
    correction_svc: CorrectionService = Depends(get_correction_service),
) -> CorrectResponse:
    """
    Grammar and fluency correction via local LLM:
    1. Validate the input text
    2. Send to Ollama with a carefully engineered prompt
    3. Clean the LLM output
    4. Generate a word-level diff for the frontend DiffViewer
    5. Return corrected text and diff

    The diff uses Google's diff-match-patch library and is cleaned
    semantically for human readability.
    """
    logger.info(
        "Correct request | {} chars | style={}",
        len(request.text),
        request.style.value,
    )

    try:
        result = await correction_svc.correct(
            text=request.text,
            style=request.style,
        )

    except OllamaConnectionError as exc:
        logger.error("Ollama connection error: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Grammar correction service is unavailable: {exc}. "
                f"Ensure Ollama is running: 'ollama serve'"
            ),
        )

    except CorrectionError as exc:
        logger.error("Correction error: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Grammar correction failed: {exc}",
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    logger.info(
        "✅ Correction done | {} changes | original={} chars → corrected={} chars",
        result.changes_count,
        len(result.original),
        len(result.corrected),
    )
    return result
