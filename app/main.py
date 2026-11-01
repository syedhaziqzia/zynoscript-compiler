"""ZynoScript - Compiler Construction Lab Project - web application entry point.   Run:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, FRONTEND_DIR, ROOT
from .db import init_db
from .routes import admin, auth, compiler, grammar, logs


@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield


app = FastAPI(
    title="ZynoScript - Compiler Construction Lab Project",
    lifespan=lifespan,
    redirect_slashes=False,
)


@app.middleware("http")
async def restore_vercel_path(request: Request, call_next):
    original_path = (
        request.headers.get("x-matched-path")
        or request.headers.get("x-invoke-path")
        or request.headers.get("x-forwarded-uri")
        or request.headers.get("x-vercel-matched-path")
    )
    if original_path and not original_path.startswith("/api/index"):
        request.scope["path"] = original_path
    elif request.scope["path"] in ("/api/index.py", "/api/index", "/api/index.py/"):
        param_path = request.query_params.get("__path") or request.query_params.get("path")
        if param_path:
            p = param_path.lstrip("/")
            if p in ("docs", "openapi.json", "redoc"):
                request.scope["path"] = f"/{p}"
            elif p.startswith("api/"):
                request.scope["path"] = f"/{p}"
            else:
                request.scope["path"] = f"/api/{p}"

    if request.scope["path"].startswith("/api") and len(request.scope["path"]) > 4 and request.scope["path"].endswith("/"):
        request.scope["path"] = request.scope["path"].rstrip("/")

    try:
        resp = await call_next(request)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"{type(exc).__name__}: {str(exc)}"},
        )
    if resp.status_code == 405 and request.scope["path"].startswith("/api"):
        resp = JSONResponse({"detail": "Not Found"}, status_code=404)

    # Standard production cybersecurity headers
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["X-XSS-Protection"] = "1; mode=block"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return resp



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

if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
