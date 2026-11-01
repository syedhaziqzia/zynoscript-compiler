"""Central settings: paths and limits."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.getenv("DB_PATH", str(ROOT / "data" / "zynoscript.db")))
FRONTEND_DIR = ROOT / "frontend"

SESSION_HOURS = int(os.getenv("SESSION_HOURS", "12"))            # how long a login token stays valid
REMEMBER_DAYS = int(os.getenv("REMEMBER_DAYS", "30"))            # lifetime when "Remember me" is ticked
MAX_SOURCE_CHARS = int(os.getenv("MAX_SOURCE_CHARS", "20000"))   # largest program accepted by the compiler endpoints
PASSWORD_MIN_LEN = int(os.getenv("PASSWORD_MIN_LEN", "6"))
CORS_ORIGINS = [orig.strip() for orig in os.getenv("CORS_ORIGINS", "*").split(",") if orig.strip()]
