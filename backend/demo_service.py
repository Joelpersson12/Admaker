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

_STEALTH_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Injected before every page load — hides Playwright/webdriver fingerprint
_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});
window.chrome = {runtime: {}};
"""


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
    from groq import Groq

    client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

    prompt = f"""You are generating a Playwright browser automation script for a screen recording demo video.
Return ONLY valid JSON.

Website URL: {url}
What to demonstrate: {description}
Voiceover script: {voiceover}

Return a JSON object with:
- "actions": array of step objects
- "caption_segments": array of {{text, start_ms, duration_ms}}

Supported action types:
  {{"type":"navigate","url":"...","wait_ms":3000}}
  {{"type":"wait","wait_ms":2000}}
  {{"type":"wait_for","selector":"css-selector","wait_ms":2000}}
  {{"type":"scroll","y":400,"wait_ms":1200}}
  {{"type":"scroll_to_bottom","wait_ms":1000}}
  {{"type":"click_text","text":"...","wait_ms":2000}}
  {{"type":"click_role","role":"button","name":"...","wait_ms":2000}}
  {{"type":"click_selector","selector":"css-selector","wait_ms":2000}}
  {{"type":"fill_placeholder","placeholder":"...","value":"...","wait_ms":800}}
  {{"type":"fill_label","label":"...","value":"...","wait_ms":800}}
  {{"type":"fill_selector","selector":"css-selector","value":"...","wait_ms":800}}
  {{"type":"press","key":"Enter","wait_ms":3000}}
  {{"type":"hover","selector":"css-selector","wait_ms":800}}

Rules:
- Always start with navigate
- After navigate use wait_ms 3000+ to let SPAs fully hydrate
- For SPAs (React/Vue/Next.js): prefer wait_for with a selector that appears after load
- Use generous wait_ms for page loads (3000+) and AI generation (8000+)
- If clicking might fail by text, also include a click_selector fallback step
- caption_segments start at 0ms, align with voiceover pacing
- Keep total under 90 seconds"""

    resp = await asyncio.to_thread(
        client.chat.completions.create,
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=2000,
    )
    return json.loads(resp.choices[0].message.content or "{}")


async def _safe_navigate(page, url: str, timeout: int = 30000) -> None:
    """Navigate with networkidle, fall back to domcontentloaded + extra wait."""
    try:
        await page.goto(url, wait_until="networkidle", timeout=timeout)
    except Exception:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            await asyncio.sleep(2.5)
        except Exception as e:
            raise RuntimeError(f"Could not load {url}: {e}") from e


async def _safe_click(page, action: dict) -> None:
    """Try multiple click strategies before giving up."""
    text = action.get("text", "")
    name = action.get("name", "")
    role = action.get("role", "button")
    selector = action.get("selector", "")
    t = action["type"]
    timeout = 8000

    errors = []

    if t == "click_text":
        strategies = [
            lambda: page.get_by_text(text, exact=True).first.click(timeout=timeout),
            lambda: page.get_by_text(text, exact=False).first.click(timeout=timeout),
            lambda: page.locator(f"text={text}").first.click(timeout=timeout),
        ]
    elif t == "click_role":
        strategies = [
            lambda: page.get_by_role(role, name=name).first.click(timeout=timeout),
            lambda: page.get_by_role(role).filter(has_text=name).first.click(timeout=timeout),
            lambda: page.locator(f"[role='{role}']", has_text=name).first.click(timeout=timeout),
        ]
    elif t == "click_selector":
        strategies = [
            lambda: page.locator(selector).first.click(timeout=timeout),
            lambda: page.locator(selector).nth(0).click(timeout=timeout, force=True),
        ]
    else:
        return

    for strategy in strategies:
        try:
            await strategy()
            return
        except Exception as e:
            errors.append(str(e))

    # Last resort: JS click on the first matching element
    try:
        if t == "click_text" and text:
            await page.evaluate(
                f"""() => {{
                    const el = Array.from(document.querySelectorAll('*'))
                        .find(e => e.textContent.trim().includes({json.dumps(text)}));
                    if (el) el.click();
                }}"""
            )
            return
    except Exception as e:
        errors.append(f"js-click: {e}")

    print(f"[demo] click failed after all strategies: {errors[-1]}")


async def _safe_fill(page, action: dict) -> None:
    placeholder = action.get("placeholder", "")
    label = action.get("label", "")
    selector = action.get("selector", "")
    value = action.get("value", "")
    t = action["type"]
    timeout = 6000

    try:
        if t == "fill_placeholder":
            try:
                await page.get_by_placeholder(placeholder).fill(value)
            except Exception:
                # Partial match fallback
                await page.locator(f"[placeholder*='{placeholder[:20]}']").first.fill(value)
        elif t == "fill_label":
            try:
                await page.get_by_label(label).fill(value)
            except Exception:
                await page.locator(f"label:has-text('{label}') + input, label:has-text('{label}') ~ input").first.fill(value)
        elif t == "fill_selector":
            await page.locator(selector).first.fill(value)
    except Exception as e:
        print(f"[demo] fill failed: {e}")


async def _record(page, frames_dir: Path, duration_ms: int, frame_state: list) -> None:
    interval = 0.1  # 10 fps
    count = max(1, int(duration_ms / 1000 * 10))
    for _ in range(count):
        idx = frame_state[0]
        try:
            data = await page.screenshot(full_page=False)
            (frames_dir / f"frame_{idx:06d}.png").write_bytes(data)
        except Exception:
            pass
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
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                    "--window-size=1280,720",
                ]
            )
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent=_STEALTH_UA,
                locale="en-US",
                timezone_id="America/New_York",
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            )
            # Hide webdriver fingerprint on every new page
            await ctx.add_init_script(_STEALTH_JS)
            page = await ctx.new_page()

            for action in actions:
                wait_ms = action.get("wait_ms", 1000)
                try:
                    t = action["type"]
                    if t == "navigate":
                        await _safe_navigate(page, action["url"])
                    elif t == "wait":
                        pass  # wait_ms handled by _record below
                    elif t == "wait_for":
                        sel = action.get("selector", "body")
                        try:
                            await page.wait_for_selector(sel, timeout=wait_ms)
                        except Exception:
                            pass
                    elif t == "scroll":
                        await page.evaluate(f"window.scrollBy(0,{action.get('y', 300)})")
                    elif t == "scroll_to_bottom":
                        await page.evaluate("window.scrollTo(0,document.body.scrollHeight)")
                    elif t in ("click_text", "click_role", "click_selector"):
                        await _safe_click(page, action)
                    elif t in ("fill_placeholder", "fill_label", "fill_selector"):
                        await _safe_fill(page, action)
                    elif t == "press":
                        await page.keyboard.press(action.get("key", "Enter"))
                    elif t == "hover":
                        sel = action.get("selector", "body")
                        try:
                            await page.locator(sel).first.hover(timeout=5000)
                        except Exception:
                            pass
                except Exception as e:
                    print(f"[demo] action {action.get('type')} failed: {e}")

                await _record(page, frames_dir, wait_ms, frame_state)

            await browser.close()

        if frame_state[0] == 0:
            raise RuntimeError("No frames captured — check that the URL is publicly reachable")

        JOBS[job_id]["status"] = "encoding"

        audio_path = str(out / "voice.mp3")
        has_audio = await _tts(voiceover, audio_path)

        srt_path = str(out / "captions.srt")
        with open(srt_path, "w") as f:
            for i, seg in enumerate(captions, 1):
                s = seg.get("start_ms", 0)
                e = s + seg.get("duration_ms", 3000)
                f.write(f"{i}\n{ms_to_srt(s)} --> {ms_to_srt(e)}\n{seg['text']}\n\n")

        raw = str(out / "raw.mp4")
        subprocess.run(
            ["ffmpeg", "-y", "-framerate", "10",
             "-i", str(frames_dir / "frame_%06d.png"),
             "-c:v", "libx264", "-pix_fmt", "yuv420p", raw],
            check=True, capture_output=True
        )

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
