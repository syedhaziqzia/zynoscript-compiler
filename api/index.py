"""Vercel Serverless Function entry point for ZynoScript FastAPI app."""
import sys
from pathlib import Path

# Ensure project root is in sys.path so 'app' can be imported anywhere in Vercel
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402, F401
