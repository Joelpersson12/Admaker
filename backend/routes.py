"""Reelix API routes — AI ad copy, AI ad video, and demo screen recording."""

from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter, Header
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.auth_service import get_user, login, register, verify_token
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
    name: str
    description: str
    audience: str
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


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoRequest(BaseModel):
    url: str
    description: str
    voiceover: str


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status, content={"status": "error", "message": message}
    )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@router.post("/api/auth/register")
def auth_register(body: RegisterRequest) -> JSONResponse:
    try:
        result = register(body.email, body.password, body.name)
        return JSONResponse(content=result)
    except ValueError as e:
        return _error(400, str(e))


@router.post("/api/auth/login")
def auth_login(body: LoginRequest) -> JSONResponse:
    try:
        result = login(body.email, body.password)
        return JSONResponse(content=result)
    except ValueError as e:
        return _error(401, str(e))


@router.get("/api/auth/me")
def auth_me(authorization: str | None = Header(default=None)) -> JSONResponse:
    if not authorization or not authorization.startswith("Bearer "):
        return _error(401, "No token")
    payload = verify_token(authorization[7:])
    if not payload:
        return _error(401, "Invalid or expired token")
    user = get_user(int(payload["sub"]))
    if not user:
        return _error(404, "User not found")
    return JSONResponse(content={"user": user})


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@router.get("/api/config")
def config() -> dict:
    return {
        "copy_enabled": bool(os.environ.get("GOOGLE_API_KEY", "")),
        "video_enabled": has_fal_key(),
    }


# ---------------------------------------------------------------------------
# AI copy generation
# ---------------------------------------------------------------------------


@router.post("/api/generate-copy")
def generate_copy(body: CopyRequest) -> JSONResponse:
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        return _error(503, "Google API key not configured — add GOOGLE_API_KEY to your .env")

    from google import genai  # type: ignore

    client = genai.Client(api_key=api_key)

    prompt = f"""You are an expert ad copywriter. Create ad copy for this product and return ONLY valid JSON.

Product name: {body.name}
Description: {body.description}
Target audience: {body.audience}
Tone: {body.tone}
Platform: {body.platform}
Ad goal: {body.goal}

Return a JSON object with exactly these keys:
- headlines: array of 3 short punchy headlines (max 10 words each)
- subheadlines: array of 3 supporting lines (max 20 words each)
- ctas: array of 3 call-to-action button texts (max 5 words each)
- body_copy: one ad body paragraph (40-60 words)
- hashtags: array of 8 relevant hashtags WITHOUT the # symbol
- hook: one ultra-short opening line for a video reel (max 10 words, surprising or provocative)
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config={"response_mime_type": "application/json", "temperature": 0.85},
        )
        data = json.loads(response.text)
        return JSONResponse(content=data)
    except Exception as exc:
        logger.error("generate_copy error: %s", exc)
        return _error(500, f"Copy generation failed: {exc}")


# ---------------------------------------------------------------------------
# AI video generation (fal.ai)
# ---------------------------------------------------------------------------


@router.post("/api/generate-video")
async def generate_video(body: VideoRequest) -> JSONResponse:
    if not has_fal_key():
        return JSONResponse(content={"status": "disabled"})

    prompt = build_video_prompt(
        product_name=body.product_name,
        description=body.description,
        target_audience=body.target_audience,
        tone=body.tone,
        hook=body.hook,
        headline=body.headline,
    )

    try:
        result = await submit_video(prompt, aspect_ratio=body.aspect_ratio, duration=body.duration)
        return JSONResponse(content={"prompt": prompt, **result})
    except Exception as exc:
        logger.error("generate_video error: %s", exc)
        return _error(500, f"Video submission failed: {exc}")


@router.get("/api/video-status")
async def get_video_status(request_id: str, model: str) -> JSONResponse:
    try:
        result = await video_status(request_id, model)
        return JSONResponse(content=result)
    except Exception as exc:
        logger.error("video_status error: %s", exc)
        return _error(500, str(exc))


# ---------------------------------------------------------------------------
# Demo screen recording
# ---------------------------------------------------------------------------


@router.post("/api/record-demo")
async def record_demo(body: DemoRequest) -> JSONResponse:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return _error(503, "OpenAI API key not configured — needed to plan the recording script")

    from backend.demo_service import start_demo_job

    job_id = start_demo_job(
        url=body.url,
        description=body.description,
        voiceover=body.voiceover,
    )
    return JSONResponse(content={"job_id": job_id, "status": "queued"})


@router.get("/api/demo-status")
def demo_status(job_id: str) -> JSONResponse:
    from backend.demo_service import get_job

    job = get_job(job_id)
    if not job:
        return _error(404, "Job not found")
    return JSONResponse(content=job)


@router.get("/api/demo-video/{job_id}")
def demo_video(job_id: str):
    from backend.demo_service import RECORDINGS_DIR, get_job

    job = get_job(job_id)
    if not job or job.get("status") != "done":
        return _error(404, "Video not ready")
    path = RECORDINGS_DIR / job_id / "final.mp4"
    if not path.exists():
        return _error(404, "Video file missing")
    return FileResponse(str(path), media_type="video/mp4")
