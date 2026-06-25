"""
Reelix demo_service — screenshot-based ad reel generator.

Flow:
  1. Groq plans 4-6 "scenes" given homepage DOM (each scene = a URL/state to show)
  2. Playwright navigates to each scene, takes ONE high-quality screenshot
  3. ffmpeg: Ken Burns zoom per scene, xfade transitions, voiceover, bottom captions
  4. Output: 1080x1920 vertical MP4, ready for Reels/TikTok/Shorts
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import traceback
import uuid
from pathlib import Path

RECORDINGS_DIR = Path("/tmp/reelix-recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)

JOBS: dict[str, dict] = {}

_STEALTH_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)

_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3]});
window.chrome = {runtime: {}};
"""

# Scene duration and transition settings
_SCENE_DUR = 2.8   # seconds each scene is shown
_FADE_DUR  = 0.35  # crossfade duration between scenes


def _ffmpeg() -> str:
    import imageio_ffmpeg  # type: ignore
    return imageio_ffmpeg.get_ffmpeg_exe()


def ms_to_srt(ms: int) -> str:
    h = ms // 3_600_000
    m = (ms % 3_600_000) // 60_000
    s = (ms % 60_000) // 1_000
    r = ms % 1_000
    return f"{h:02d}:{m:02d}:{s:02d},{r:03d}"


# ── TTS ────────────────────────────────────────────────────────────────────────

async def _tts(text: str, path: str, voice: str = "en-US-GuyNeural") -> bool:
    try:
        import edge_tts  # type: ignore
        await edge_tts.Communicate(text, voice, rate="+12%", pitch="-3Hz").save(path)
        return Path(path).exists() and Path(path).stat().st_size > 0
    except Exception as e:
        print(f"[demo] TTS error: {e}")
        return False


# ── DOM extraction ─────────────────────────────────────────────────────────────

async def _extract_dom(page) -> dict:
    try:
        return await page.evaluate("""() => {
            const txt = t => (t||'').trim().replace(/\\s+/g,' ').slice(0,80);
            return {
                url: location.href,
                title: document.title,
                headings: [...document.querySelectorAll('h1,h2,h3')].slice(0,5).map(e=>txt(e.innerText)),
                buttons: [...document.querySelectorAll('button,[role=button]')].slice(0,20)
                    .map(e=>({text:txt(e.innerText),id:e.id||null})).filter(b=>b.text),
                links: [...document.querySelectorAll('a[href]')].slice(0,20)
                    .map(e=>({text:txt(e.innerText),href:e.href})).filter(l=>l.text),
                inputs: [...document.querySelectorAll('input[placeholder],textarea')].slice(0,8)
                    .map(e=>({placeholder:e.placeholder||'',id:e.id||null})),
            };
        }""")
    except Exception:
        return {}


# ── Groq scene planning ────────────────────────────────────────────────────────

async def _plan_scenes(dom: dict, description: str, voiceover: str) -> dict:
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set in deployment secrets")

    client = Groq(api_key=api_key)

    prompt = f"""You are planning a short social-media ad video (Reels style) for a website.
The video is made by taking SCREENSHOTS of key moments and assembling them with voiceover.
Return ONLY valid JSON.

Homepage DOM (real data):
{json.dumps(dom, indent=2)}

What to show: {description}
Voiceover script: {voiceover}

Plan 4-6 scenes. Each scene is a page state to screenshot.
For scenes that need a text input filled (like a search or prompt), include fill_selector + fill_value.

Return JSON:
{{
  "scenes": [
    {{
      "url": "full URL to navigate to (use hash routes like https://cadio.net/#builder if needed)",
      "wait_ms": 2500,
      "caption": "Short punchy caption for this scene (max 8 words)",
      "fill_selector": "CSS selector or null",
      "fill_value": "text to type or null"
    }}
  ],
  "caption_segments": [
    {{"text": "caption text", "start_ms": 0, "duration_ms": 2500}}
  ]
}}

Rules:
- First scene should always be the homepage
- Use the EXACT button texts and link hrefs from DOM above
- For hash-routes: use navigate with full URL (e.g. https://cadio.net/#builder)
- wait_ms: how long to wait after navigating BEFORE taking the screenshot (let the page render)
  - Simple pages: 1500ms. SPAs/dynamic content: 3000ms. AI generation: 5000ms.
- keep captions SHORT and punchy — max 8 words per scene, hooks like "Did you know?"
- caption_segments should cover the full voiceover timing"""

    resp = await asyncio.wait_for(
        asyncio.to_thread(
            client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1500,
        ),
        timeout=30,
    )
    return json.loads(resp.choices[0].message.content or "{}")


# ── Playwright screenshot capture ──────────────────────────────────────────────

async def _navigate(page, url: str, wait_ms: int) -> None:
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
    except Exception as e:
        print(f"[demo] navigate failed: {e}")
        return
    try:
        await page.wait_for_load_state("networkidle", timeout=4000)
    except Exception:
        pass
    await asyncio.sleep(wait_ms / 1000)


async def _capture_scenes(scenes: list, out: Path) -> list[Path]:
    """Navigate to each scene, optionally fill an input, take one screenshot."""
    from playwright.async_api import async_playwright  # type: ignore

    shots: list[Path] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=[
            "--no-sandbox", "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
        ])
        ctx = await browser.new_context(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
            user_agent=_STEALTH_UA,
            locale="en-US",
        )
        await ctx.add_init_script(_STEALTH_JS)
        page = await ctx.new_page()
        page.set_default_timeout(8000)
        page.set_default_navigation_timeout(20000)

        for i, scene in enumerate(scenes):
            url      = scene.get("url", "")
            wait_ms  = min(int(scene.get("wait_ms", 2000)), 5000)
            fill_sel = scene.get("fill_selector")
            fill_val = scene.get("fill_value")

            if not url:
                continue

            await _navigate(page, url, wait_ms)

            # Optional: fill a text input (e.g. "headset stand" into the builder prompt)
            if fill_sel and fill_val:
                try:
                    el = page.locator(fill_sel).first
                    await el.fill(fill_val, timeout=5000)
                    await asyncio.sleep(0.5)
                    # Press Enter to submit if it looks like a search/prompt
                    await page.keyboard.press("Enter")
                    # Wait for result to appear
                    await asyncio.sleep(min(wait_ms / 1000, 4))
                except Exception as e:
                    print(f"[demo] fill scene {i} failed: {e}")

            # Take the screenshot
            shot = out / f"scene_{i:02d}.png"
            try:
                await page.screenshot(path=str(shot), full_page=False)
                shots.append(shot)
                print(f"[demo] scene {i} captured: {shot.name}")
            except Exception as e:
                print(f"[demo] screenshot scene {i} failed: {e}")

        await browser.close()

    return shots


# ── ffmpeg video assembly ──────────────────────────────────────────────────────

def _build_video(shots: list[Path], audio_path: str | None, srt_path: str, out: Path) -> Path:
    ffmpeg = _ffmpeg()
    n = len(shots)
    clips: list[Path] = []

    # Step 1: Ken Burns clip per screenshot (zoom-in / zoom-out alternating)
    for i, shot in enumerate(shots):
        clip = out / f"clip_{i:02d}.mp4"
        frames = int(_SCENE_DUR * 24)
        if i % 2 == 0:
            zoom_expr = "z='min(zoom+0.0012,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        else:
            zoom_expr = "z='if(eq(on,1),1.12,max(zoom-0.0012,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"

        vf = (
            "scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,"
            f"zoompan={zoom_expr}:d={frames}:s=1080x1920:fps=24"
        )
        r = subprocess.run([
            ffmpeg, "-y",
            "-loop", "1", "-framerate", "24", "-t", str(_SCENE_DUR),
            "-i", str(shot),
            "-vf", vf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", str(clip)
        ], capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(f"Ken Burns clip {i} failed: {r.stderr[-300:]}")
        clips.append(clip)

    # Step 2: xfade chain to join all clips
    inputs: list[str] = []
    for c in clips:
        inputs += ["-i", str(c)]

    filt_parts: list[str] = []
    last = "[0:v]"
    for i in range(1, n):
        offset = _SCENE_DUR * i - _FADE_DUR * i
        label = f"[v{i}]" if i < n - 1 else "[outv]"
        filt_parts.append(
            f"{last}[{i}:v]xfade=transition=fade:duration={_FADE_DUR}:offset={offset:.3f}{label}"
        )
        last = label
    filt = ";".join(filt_parts)

    merged = out / "merged.mp4"
    r = subprocess.run(
        [ffmpeg, "-y"] + inputs + [
            "-filter_complex", filt,
            "-map", "[outv]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", str(merged)
        ], capture_output=True, text=True
    )
    if r.returncode != 0:
        raise RuntimeError(f"xfade merge failed: {r.stderr[-400:]}")

    # Step 3: add captions + audio
    final = out / "final.mp4"
    srt_escaped = str(srt_path).replace("\\", "\\\\").replace(":", "\\:")
    caption_style = (
        "Fontsize=44,Bold=1,"
        "PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,"
        "BorderStyle=1,Outline=3,Shadow=1,"
        "Alignment=2,MarginV=100"
    )
    vf = f"subtitles={srt_escaped}:force_style='{caption_style}'"

    cmd = [ffmpeg, "-y", "-i", str(merged)]
    if audio_path and Path(audio_path).exists():
        cmd += ["-i", audio_path, "-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += ["-vf", vf, "-c:v", "libx264", "-crf", "20", "-preset", "fast", str(final)]

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Final encode failed: {r.stderr[-400:]}")

    return final


# ── Job management ─────────────────────────────────────────────────────────────

async def _run_recording(job_id: str, url: str, description: str, voiceover: str) -> None:
    task = asyncio.create_task(_do_recording(job_id, url, description, voiceover))

    async def _watchdog() -> None:
        await asyncio.sleep(180)  # 3-minute hard cap
        if JOBS.get(job_id, {}).get("status") not in ("done", "error"):
            task.cancel()
            JOBS[job_id].update({"status": "error",
                                  "error": "Timed out — try a shorter description"})

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

    try:
        from playwright.async_api import async_playwright  # type: ignore

        # ── 1. Load homepage, extract DOM ──────────────────────────────────
        async with async_playwright() as p:
            browser = await p.chromium.launch(args=[
                "--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"
            ])
            ctx = await browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True, user_agent=_STEALTH_UA
            )
            await ctx.add_init_script(_STEALTH_JS)
            page = await ctx.new_page()
            page.set_default_timeout(10000)

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                await asyncio.sleep(2)
            except Exception as e:
                raise RuntimeError(f"Cannot reach {url}: {e}")

            dom = await _extract_dom(page)
            await browser.close()

        print(f"[demo] DOM extracted: {len(dom.get('buttons',[]))} buttons")

        # ── 2. Plan scenes with Groq ───────────────────────────────────────
        plan = await _plan_scenes(dom, description, voiceover)
        scenes = plan.get("scenes", [])
        captions = plan.get("caption_segments", [])
        print(f"[demo] {len(scenes)} scenes planned: {json.dumps(scenes)}")

        if not scenes:
            raise RuntimeError("Groq returned no scenes — try a different description")

        # ── 3. Capture screenshots ─────────────────────────────────────────
        JOBS[job_id]["status"] = "recording"
        shots = await _capture_scenes(scenes, out)

        if not shots:
            raise RuntimeError("No screenshots captured — check that the URL is reachable")

        # ── 4. TTS ────────────────────────────────────────────────────────
        JOBS[job_id]["status"] = "encoding"
        audio_path = str(out / "voice.mp3")
        has_audio = await _tts(voiceover, audio_path)

        # ── 5. SRT captions ───────────────────────────────────────────────
        srt_path = str(out / "captions.srt")
        # Auto-generate per-scene captions if Groq didn't supply them
        if not captions:
            t = 0
            per = int(_SCENE_DUR * 1000)
            for i, sc in enumerate(scenes):
                cap = sc.get("caption", "")
                if cap:
                    captions.append({"text": cap, "start_ms": t, "duration_ms": per - 200})
                t += per

        with open(srt_path, "w") as f:
            for i, seg in enumerate(captions, 1):
                s = seg.get("start_ms", 0)
                e = s + seg.get("duration_ms", 2500)
                f.write(f"{i}\n{ms_to_srt(s)} --> {ms_to_srt(e)}\n{seg['text']}\n\n")

        # ── 6. Build video ────────────────────────────────────────────────
        final = await asyncio.to_thread(
            _build_video, shots, audio_path if has_audio else None, srt_path, out
        )

        JOBS[job_id].update({"status": "done", "video_path": str(final)})
        print(f"[demo] done: {final} ({final.stat().st_size//1024}KB)")

    except Exception as e:
        JOBS[job_id].update({"status": "error", "error": str(e)})
        print(f"[demo] FAILED: {traceback.format_exc()}")


async def start_demo_job(url: str, description: str, voiceover: str) -> str:
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"status": "queued"}
    asyncio.create_task(_run_recording(job_id, url, description, voiceover))
    return job_id


def get_job(job_id: str) -> dict | None:
    return JOBS.get(job_id)
