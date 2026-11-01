"""ZynoScript - Compiler Construction Lab Project - web application entry point.   Run:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, FRONTEND_DIR
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
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
