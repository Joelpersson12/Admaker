"""Reelix API routes — AI ad copy and AI ad video generation."""

from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.video_service import (
    build_video_prompt,
    has_fal_key,
    submit_video,
    video_status,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class CopyRequest(BaseModel):
    product_name: str
    description: str
    target_audience: str
    tone: str = "professional"
    platform: str = "instagram"
    goal: str = "sales"


class VideoRequest(BaseModel):
    product_name: str
    description: str
    target_audience: str
    tone: str = "professional"
    platform: str = "instagram"
    hook: str = ""
    headline: str = ""
    aspect_ratio: str = "9:16"
    duration: str = "5"


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status, content={"status": "error", "message": message}
    )


# ---------------------------------------------------------------------------
# Config — lets the frontend know which features are live
# ---------------------------------------------------------------------------


@router.get("/api/config")
def config() -> dict[str, bool]:
    return {
        "copy_enabled": bool(os.environ.get("OPENAI_API_KEY", "")),
        "video_enabled": has_fal_key(),
    }


# ---------------------------------------------------------------------------
# AI copy generation (OpenAI)
# ---------------------------------------------------------------------------


@router.post("/api/generate-copy")
def generate_copy(body: CopyRequest) -> JSONResponse:
    """Generate ad copy for a product using OpenAI GPT-4o."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return _error(503, "OpenAI API key not configured")

    from openai import OpenAI

    client = OpenAI(api_key=api_key)

    system_prompt = (
        "You are an expert advertising copywriter who creates high-converting "
        "ad copy. Always return valid JSON only, no markdown, no extra text."
    )
    user_prompt = f"""Create ad copy for the following product:

Product name: {body.product_name}
Description: {body.description}
Target audience: {body.target_audience}
Tone: {body.tone}
Platform: {body.platform}
Ad goal: {body.goal}

Return a JSON object with exactly these keys:
- headlines: array of exactly 3 short, punchy headlines (max 10 words each)
- subheadlines: array of exactly 3 supporting lines (max 20 words each)
- ctas: array of exactly 3 call-to-action button texts (max 5 words each)
- body_copy: one paragraph of ad body copy (40-60 words)
- hashtags: array of exactly 8 relevant hashtags without the # symbol
- hook: one ultra-short attention-grabbing opening line for a video reel (max 10 words, make it surprising or provocative)
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.85,
            max_tokens=800,
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        return JSONResponse(content={"status": "ok", "data": data})
    except Exception as exc:
        logger.error("generate_copy error: %s", exc)
        return _error(500, f"Copy generation failed: {exc}")


# ---------------------------------------------------------------------------
# AI video generation (fal.ai text-to-video)
# ---------------------------------------------------------------------------


@router.post("/api/generate-video")
async def generate_video(body: VideoRequest) -> JSONResponse:
    """Kick off an AI video generation job. Returns a request_id to poll."""
    if not has_fal_key():
        return JSONResponse(
            content={
                "status": "disabled",
                "message": "No FAL_KEY configured — showing animated preview instead.",
            }
        )

    prompt = build_video_prompt(
        product_name=body.product_name,
        description=body.description,
        target_audience=body.target_audience,
        tone=body.tone,
        hook=body.hook,
        headline=body.headline,
    )

    try:
        result = await submit_video(
            prompt,
            aspect_ratio=body.aspect_ratio,
            duration=body.duration,
        )
        return JSONResponse(content={"status": "ok", "prompt": prompt, **result})
    except Exception as exc:
        logger.error("generate_video error: %s", exc)
        return _error(500, f"Video submission failed: {exc}")


@router.get("/api/video-status")
async def get_video_status(request_id: str, model: str) -> JSONResponse:
    """Poll the status of a video generation job."""
    try:
        result = await video_status(request_id, model)
        return JSONResponse(content={"status": "ok", **result})
    except Exception as exc:
        logger.error("video_status error: %s", exc)
        return _error(500, str(exc))
