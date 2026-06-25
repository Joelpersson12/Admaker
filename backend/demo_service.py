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


async def _tts(text: str, path: str, voice: str = "en-US-GuyNeural") -> bool:
    try:
        import edge_tts  # type: ignore
        communicate = edge_tts.Communicate(text, voice, rate="+12%", pitch="-3Hz")
        await communicate.save(path)
        return True
    except Exception as e:
        print(f"[demo] TTS error: {e}")
        return False


async def _extract_page_info(page) -> dict:
    """Read the live DOM to give Groq real element data to work with."""
    try:
        return await page.evaluate("""() => {
            const text = t => (t || '').trim().replace(/\\s+/g, ' ').slice(0, 60);

            const buttons = Array.from(document.querySelectorAll(
                'button, [role="button"], input[type="button"], input[type="submit"]'
            )).slice(0, 20).map(el => ({
                text: text(el.innerText || el.value),
                id: el.id || null,
                cls: el.className ? el.className.toString().slice(0, 60) : null,
            })).filter(b => b.text);

            const links = Array.from(document.querySelectorAll('a[href]'))
                .slice(0, 20)
                .map(el => ({ text: text(el.innerText), href: el.href }))
                .filter(l => l.text);

            const inputs = Array.from(document.querySelectorAll(
                'input[placeholder], textarea[placeholder], input[type="text"], textarea'
            )).slice(0, 10).map(el => ({
                placeholder: el.placeholder || '',
                id: el.id || null,
                name: el.name || null,
            }));

            const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
                .slice(0, 6).map(el => text(el.innerText));

            return {
                url: window.location.href,
                title: document.title,
                headings,
                buttons,
                links,
                inputs,
            };
        }""")
    except Exception as e:
        print(f"[demo] DOM extract failed: {e}")
        return {}


async def _plan_actions(page_info: dict, description: str, voiceover: str) -> dict:
    from groq import Groq

    client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

    page_summary = json.dumps(page_info, indent=2)

    prompt = f"""You are generating a Playwright browser automation script for a screen recording demo video.
Return ONLY valid JSON.

The browser has already loaded the page. Here is what is ACTUALLY on the page right now:
{page_summary}

What to demonstrate: {description}
Voiceover script: {voiceover}

Return a JSON object with:
- "actions": array of step objects (do NOT include a navigate to the start URL — browser is already there)
- "caption_segments": array of {{text, start_ms, duration_ms}}

Supported action types:
  {{"type":"wait","wait_ms":2000}}
  {{"type":"wait_for","selector":"css-selector","wait_ms":2000}}
  {{"type":"navigate","url":"...","wait_ms":3000}}
  {{"type":"scroll","y":400,"wait_ms":1200}}
  {{"type":"scroll_to_bottom","wait_ms":1000}}
  {{"type":"click_text","text":"EXACT text from the button/link list above","wait_ms":2000}}
  {{"type":"click_selector","selector":"css-selector","wait_ms":2000}}
  {{"type":"fill_placeholder","placeholder":"exact placeholder text","value":"...","wait_ms":800}}
  {{"type":"fill_selector","selector":"css-selector","value":"...","wait_ms":800}}
  {{"type":"press","key":"Enter","wait_ms":2000}}

Rules:
- Use EXACT button/link text from the page data above for click_text actions
- If a button has an id or class in the data, prefer click_selector with #id or .classname
- For hash-route navigation (e.g. /#builder), use {{"type":"navigate","url":"https://example.com/#builder"}}
- After any navigation or click that changes the page, use wait_ms 2500-3000
- Total sum of all wait_ms must be under 45000ms
- Maximum 14 actions
- caption_segments start at 0ms"""

    resp = await asyncio.to_thread(
        client.chat.completions.create,
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=2000,
    )
    return json.loads(resp.choices[0].message.content or "{}")


async def _safe_navigate(page, url: str) -> None:
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)
    except Exception as e:
        raise RuntimeError(f"Could not load {url}: {e}") from e
    try:
        await page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:
        await asyncio.sleep(2.0)


async def _safe_click(page, action: dict) -> None:
    text = action.get("text", "")
    name = action.get("name", "")
    role = action.get("role", "button")
    selector = action.get("selector", "")
    t = action["type"]
    TO = 6000

    errors = []

    if t == "click_text":
        strategies = [
            lambda: page.get_by_text(text, exact=True).first.click(timeout=TO),
            lambda: page.get_by_text(text, exact=False).first.click(timeout=TO),
            lambda: page.locator(f"text={text}").first.click(timeout=TO),
        ]
    elif t == "click_role":
        strategies = [
            lambda: page.get_by_role(role, name=name).first.click(timeout=TO),
            lambda: page.get_by_role(role).filter(has_text=name).first.click(timeout=TO),
        ]
    elif t == "click_selector":
        strategies = [
            lambda: page.locator(selector).first.click(timeout=TO),
            lambda: page.locator(selector).nth(0).click(timeout=TO, force=True),
        ]
    else:
        return

    for strategy in strategies:
        try:
            await strategy()
            return
        except Exception as e:
            errors.append(str(e))

    # JS click fallback
    try:
        if t == "click_text" and text:
            await page.evaluate(
                f"""() => {{
                    const el = Array.from(document.querySelectorAll('button,a,[role=button]'))
                        .find(e => e.textContent.trim().includes({json.dumps(text)}));
                    if (el) el.click();
                }}"""
            )
            return
        elif t == "click_selector" and selector:
            await page.evaluate(
                f"""() => {{ const el = document.querySelector({json.dumps(selector)}); if (el) el.click(); }}"""
            )
            return
    except Exception as e:
        errors.append(f"js: {e}")

    print(f"[demo] click failed: {errors[-1] if errors else 'unknown'}")


async def _safe_fill(page, action: dict) -> None:
    placeholder = action.get("placeholder", "")
    label = action.get("label", "")
    selector = action.get("selector", "")
    value = action.get("value", "")
    t = action["type"]
    TO = 6000

    try:
        if t == "fill_placeholder":
            try:
                await page.get_by_placeholder(placeholder).fill(value, timeout=TO)
            except Exception:
                await page.locator(f"[placeholder*='{placeholder[:20]}']").first.fill(value, timeout=TO)
        elif t == "fill_label":
            try:
                await page.get_by_label(label).fill(value, timeout=TO)
            except Exception:
                await page.locator(
                    f"label:has-text('{label}') + input, label:has-text('{label}') ~ input"
                ).first.fill(value, timeout=TO)
        elif t == "fill_selector":
            await page.locator(selector).first.fill(value, timeout=TO)
    except Exception as e:
        print(f"[demo] fill failed: {e}")


async def _record(page, frames_dir: Path, duration_ms: int, frame_state: list) -> None:
    interval = 0.1
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
    task = asyncio.create_task(_do_recording(job_id, url, description, voiceover))

    async def _watchdog() -> None:
        await asyncio.sleep(300)
        if JOBS.get(job_id, {}).get("status") not in ("done", "error"):
            task.cancel()
            JOBS[job_id].update({"status": "error", "error": "Timed out after 5 minutes"})

    watchdog = asyncio.create_task(_watchdog())
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception as e:
        JOBS[job_id].update({"status": "error", "error": str(e)})
    finally:
        watchdog.cancel()


async def _do_recording(job_id: str, url: str, description: str, voiceover: str) -> None:
    JOBS[job_id]["status"] = "planning"
    out = RECORDINGS_DIR / job_id
    out.mkdir(exist_ok=True)
    frames_dir = out / "frames"
    frames_dir.mkdir(exist_ok=True)

    from playwright.async_api import async_playwright  # type: ignore

    try:
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
            await ctx.add_init_script(_STEALTH_JS)
            page = await ctx.new_page()
            page.set_default_timeout(8000)
            page.set_default_navigation_timeout(25000)

            # Step 1: navigate and read the real DOM
            await _safe_navigate(page, url)
            page_info = await _extract_page_info(page)
            print(f"[demo] page info: {json.dumps(page_info)[:500]}")

            # Step 2: plan with real DOM context
            plan = await _plan_actions(page_info, description, voiceover)
            actions = plan.get("actions", [])
            captions = plan.get("caption_segments", [])
            print(f"[demo] plan: {len(actions)} actions")

            JOBS[job_id]["status"] = "recording"
            frame_state = [0]

            # Record homepage while it's loaded (2s)
            await _record(page, frames_dir, 2000, frame_state)

            # Step 3: execute actions
            for action in actions:
                wait_ms = min(action.get("wait_ms", 1000), 6000)
                try:
                    t = action["type"]
                    if t == "navigate":
                        await _safe_navigate(page, action["url"])
                    elif t == "wait":
                        pass
                    elif t == "wait_for":
                        try:
                            await page.wait_for_selector(action.get("selector", "body"), timeout=6000)
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
                        try:
                            await page.locator(action.get("selector", "body")).first.hover(timeout=4000)
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


async def start_demo_job(url: str, description: str, voiceover: str) -> str:
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"status": "queued"}
    asyncio.create_task(_run_recording(job_id, url, description, voiceover))
    return job_id


def get_job(job_id: str) -> dict | None:
    return JOBS.get(job_id)
