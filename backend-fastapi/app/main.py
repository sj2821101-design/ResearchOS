"""ResearchOS V1 应用入口。

运行方式（在 backend/ 目录下）：
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
或：
    python run.py
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .api.routes import router
from .config import PROJECT_ROOT, settings

FRONTEND_DIR = PROJECT_ROOT / "frontend"


def create_app() -> FastAPI:
    db.init_db()

    app = FastAPI(title="ResearchOS V1", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/api")

    if FRONTEND_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

        @app.get("/", include_in_schema=False)
        def index() -> FileResponse:
            return FileResponse(FRONTEND_DIR / "index.html")

    return app


app = create_app()
