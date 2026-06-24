from __future__ import annotations

import asyncio
import json
import os
import subprocess
import uuid
from pathlib import Path

RECORDINGS_DIR = Path("/tmp/reelix-recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)

JOBS: dict[str, dict] = {}


def ms_to_srt(ms: int) -> str:
    h = ms // 3_600_000
    m = (ms % 3_600_000) // 60_000
    s = (ms % 60_000) // 1_000
    r = ms % 1_000
    return f"{h:02d}:{m:02d}:{s:02d},{r:03d}"


async def _tts(text: str, path: str, voice: str = "en-US-AriaNeural") -> bool:
    try:
        import edge_tts  # type: ignore
        await edge_tts.Communicate(text, voice).save(path)
        return True
    except Exception as e:
        print(f"[demo] TTS error: {e}")
        return False


async def _plan_actions(url: str, description: str, voiceover: str) -> dict:
    import openai
    client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    prompt = f"""You are generating a Playwright browser automation script for a screen recording demo video.

Website URL: {url}
What to demonstrate: {description}
Voiceover script (will be spoken over the video): {voiceover}

Return a JSON object with:
- "actions": array of step objects
- "caption_segments": array of {{text, start_ms, duration_ms}}

Supported action types:
  {{"type":"navigate","url":"...","wait_ms":2500}}
  {{"type":"wait","wait_ms":2000}}
  {{"type":"scroll","y":400,"wait_ms":1200}}
  {{"type":"scroll_to_bottom","wait_ms":1000}}
  {{"type":"click_text","text":"...","wait_ms":1800}}
  {{"type":"click_role","role":"button","name":"...","wait_ms":1800}}
  {{"type":"fill_placeholder","placeholder":"...","value":"...","wait_ms":600}}
  {{"type":"fill_label","label":"...","value":"...","wait_ms":600}}
  {{"type":"press","key":"Enter","wait_ms":3000}}

Rules:
- Always start with a navigate action
- Use generous wait_ms for page loads (2500+) and AI generation (8000+)
- caption_segments should align roughly with the voiceover, start at 0
- Keep total under 90 seconds
- Use click_text for links/buttons when you know the label
- Use fill_placeholder for search or prompt fields

Return ONLY valid JSON."""

    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


async def _record(page, frames_dir: Path, duration_ms: int, frame_state: list) -> None:
    interval = 0.1  # 10 fps
    count = max(1, int(duration_ms / 1000 * 10))
    for _ in range(count):
        idx = frame_state[0]
        data = await page.screenshot()
        (frames_dir / f"frame_{idx:06d}.png").write_bytes(data)
        frame_state[0] += 1
        await asyncio.sleep(interval)


async def _run_recording(job_id: str, url: str, description: str, voiceover: str) -> None:
    JOBS[job_id]["status"] = "planning"
    out = RECORDINGS_DIR / job_id
    out.mkdir(exist_ok=True)
    frames_dir = out / "frames"
    frames_dir.mkdir(exist_ok=True)

    try:
        plan = await _plan_actions(url, description, voiceover)
        actions = plan.get("actions", [])
        captions = plan.get("caption_segments", [])
        JOBS[job_id]["status"] = "recording"

        from playwright.async_api import async_playwright  # type: ignore
        frame_state = [0]

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"]
            )
            ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
            page = await ctx.new_page()

            for action in actions:
                wait_ms = action.get("wait_ms", 1000)
                try:
                    t = action["type"]
                    if t == "navigate":
                        await page.goto(action["url"], wait_until="domcontentloaded", timeout=20000)
                    elif t == "scroll":
                        await page.evaluate(f"window.scrollBy(0,{action.get('y',300)})")
                    elif t == "scroll_to_bottom":
                        await page.evaluate("window.scrollTo(0,document.body.scrollHeight)")
                    elif t == "click_text":
                        await page.get_by_text(action["text"], exact=False).first.click(timeout=6000)
                    elif t == "click_role":
                        await page.get_by_role(action["role"], name=action.get("name","")).first.click(timeout=6000)
                    elif t == "fill_placeholder":
                        await page.get_by_placeholder(action["placeholder"]).fill(action["value"])
                    elif t == "fill_label":
                        await page.get_by_label(action["label"]).fill(action["value"])
                    elif t == "press":
                        await page.keyboard.press(action.get("key","Enter"))
                    elif t == "wait":
                        pass
                except Exception as e:
                    print(f"[demo] action {action} failed: {e}")

                await _record(page, frames_dir, wait_ms, frame_state)

            await browser.close()

        if frame_state[0] == 0:
            raise RuntimeError("No frames captured — check URL and actions")

        JOBS[job_id]["status"] = "encoding"

        # TTS
        audio_path = str(out / "voice.mp3")
        has_audio = await _tts(voiceover, audio_path)

        # SRT
        srt_path = str(out / "captions.srt")
        with open(srt_path, "w") as f:
            for i, seg in enumerate(captions, 1):
                s = seg.get("start_ms", 0)
                e = s + seg.get("duration_ms", 3000)
                f.write(f"{i}\n{ms_to_srt(s)} --> {ms_to_srt(e)}\n{seg['text']}\n\n")

        # ffmpeg: frames → raw video
        raw = str(out / "raw.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-framerate", "10",
             "-i", str(frames_dir / "frame_%06d.png"),
             "-c:v", "libx264", "-pix_fmt", "yuv420p", raw],
            check=True, capture_output=True
        )

        # ffmpeg: add captions + audio
        final = str(out / "final.mp4")
        vf = (
            f"subtitles={srt_path}:force_style='"
            "Fontsize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
            "BorderStyle=3,Outline=2,Shadow=0,Alignment=2,MarginV=30'"
        )
        cmd = ["ffmpeg", "-y", "-i", raw]
        if has_audio and Path(audio_path).exists():
            cmd += ["-i", audio_path, "-c:a", "aac", "-shortest"]
        cmd += ["-vf", vf, "-c:v", "libx264", final]
        subprocess.run(cmd, check=True, capture_output=True)

        JOBS[job_id].update({"status": "done", "video_path": final})

    except Exception as e:
        JOBS[job_id].update({"status": "error", "error": str(e)})


def start_demo_job(url: str, description: str, voiceover: str) -> str:
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"status": "queued"}
    asyncio.create_task(_run_recording(job_id, url, description, voiceover))
    return job_id


def get_job(job_id: str) -> dict | None:
    return JOBS.get(job_id)
