"""Vercel Serverless Function entry point for ZynoScript FastAPI app."""
import sys
from pathlib import Path

# Ensure project root is in sys.path so 'app' can be imported anywhere in Vercel
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402

# Ensure PostgreSQL tables are created on lambda startup
try:
    init_db()
except Exception as e:
    print(f"Warning on lambda cold start DB init: {e}")
