"""ZynoScript - Compiler Construction Lab Project - web application entry point.   Run:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, FRONTEND_DIR, ROOT
from .db import init_db
from .routes import admin, auth, compiler, grammar, logs


@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield


app = FastAPI(title="ZynoScript - Compiler Construction Lab Project", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, grammar, compiler, logs, admin):
    app.include_router(module.router)

STATIC_DIR = ROOT / "public" if (ROOT / "public").exists() else FRONTEND_DIR


@app.get("/", response_class=HTMLResponse)
def serve_index():
    for candidate in (STATIC_DIR / "index.html", FRONTEND_DIR / "index.html"):
        if candidate.exists():
            return HTMLResponse(content=candidate.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>ZynoScript Studio</h1>")


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
