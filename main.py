"""Reelix — AI ad video maker. Application entry point.

Serves the built frontend and mounts the API router (copy + video).
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.auth_service import init_db
from backend.routes import router

app = FastAPI(title="Reelix", version="1.0.0")

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "reelix"}


PROJECT_ROOT = Path(__file__).resolve().parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

if (FRONTEND_DIST / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="assets",
    )


@app.get("/", response_class=HTMLResponse, response_model=None)
def serve_root() -> FileResponse | HTMLResponse:
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return HTMLResponse(
        "<h1>Reelix API</h1><p>Frontend not built. "
        "Run: cd frontend &amp;&amp; npm install &amp;&amp; npm run build</p>"
    )


@app.get("/{full_path:path}", response_class=HTMLResponse, response_model=None)
def serve_spa(full_path: str) -> FileResponse | JSONResponse:
    if full_path.startswith("api/"):
        return JSONResponse(
            status_code=404, content={"status": "error", "message": "Not found"}
        )
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse(
        status_code=404, content={"status": "error", "message": "Not found"}
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
