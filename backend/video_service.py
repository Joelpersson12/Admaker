"""fal.ai text-to-video integration for Reelix.

Uses the fal.ai queue API to submit a video generation job and poll for
the result.  All configuration is read from environment variables so the
app runs without a key (falling back to the animated preview on the
frontend).

Get an API key at https://fal.ai
"""

from __future__ import annotations

import os
from typing import Any

import httpx

FAL_KEY = os.environ.get("FAL_KEY", "")

# The text-to-video model to use. Override with the FAL_VIDEO_MODEL env var.
# Browse available models at https://fal.ai/models?categories=text-to-video
DEFAULT_MODEL = os.environ.get(
    "FAL_VIDEO_MODEL", "fal-ai/kling-video/v1.6/standard/text-to-video"
)

FAL_QUEUE_BASE = "https://queue.fal.run"


def has_fal_key() -> bool:
    """True when a fal.ai API key is configured."""
    return bool(FAL_KEY)


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Key {FAL_KEY}",
        "Content-Type": "application/json",
    }


async def submit_video(
    prompt: str,
    aspect_ratio: str = "9:16",
    duration: str = "5",
    model: str | None = None,
) -> dict[str, Any]:
    """Submit a text-to-video job to the fal.ai queue.

    Returns a dict with ``request_id`` and the ``model`` used so the
    frontend can poll for status.
    """
    model_id = model or DEFAULT_MODEL
    payload: dict[str, Any] = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "duration": duration,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{FAL_QUEUE_BASE}/{model_id}",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    return {
        "request_id": data.get("request_id"),
        "model": model_id,
        "status": data.get("status", "IN_QUEUE"),
    }


async def video_status(request_id: str, model: str) -> dict[str, Any]:
    """Poll a fal.ai job. When complete, returns the video URL."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        status_resp = await client.get(
            f"{FAL_QUEUE_BASE}/{model}/requests/{request_id}/status",
            headers=_headers(),
        )
        status_resp.raise_for_status()
        status_data = status_resp.json()
        status = status_data.get("status")

        if status == "COMPLETED":
            result_resp = await client.get(
                f"{FAL_QUEUE_BASE}/{model}/requests/{request_id}",
                headers=_headers(),
            )
            result_resp.raise_for_status()
            result = result_resp.json()
            return {
                "status": "COMPLETED",
                "video_url": _extract_video_url(result),
            }

        return {
            "status": status,
            "queue_position": status_data.get("queue_position"),
        }


def _extract_video_url(result: dict[str, Any]) -> str | None:
    """Pull the video URL out of a fal.ai result (formats vary by model)."""
    video = result.get("video")
    if isinstance(video, dict):
        return video.get("url")
    if isinstance(video, str):
        return video

    videos = result.get("videos")
    if isinstance(videos, list) and videos:
        first = videos[0]
        if isinstance(first, dict):
            return first.get("url")
        if isinstance(first, str):
            return first

    # Some models nest under "output"
    output = result.get("output")
    if isinstance(output, dict):
        return _extract_video_url(output)

    return None


def build_video_prompt(
    product_name: str,
    description: str,
    target_audience: str,
    tone: str,
    hook: str = "",
    headline: str = "",
) -> str:
    """Compose a cinematic text-to-video prompt from product info."""
    style_map = {
        "professional": "sleek, premium, cinematic commercial style",
        "casual": "bright, friendly, lifestyle style",
        "urgent": "fast-paced, dynamic, high-energy style",
        "inspirational": "epic, uplifting, aspirational style",
    }
    style = style_map.get(tone, "cinematic commercial style")

    parts = [
        f"A {style} advertisement video for {product_name}.",
        description.strip(),
        f"Concept: {headline}." if headline else "",
        f"For an audience of {target_audience}." if target_audience else "",
        (
            "Professional product cinematography, smooth dynamic camera motion, "
            "vibrant cinematic lighting, modern and clean, highly detailed, 4k."
        ),
    ]
    return " ".join(p for p in parts if p)
