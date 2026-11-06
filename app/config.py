"""Central settings: paths and limits."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if os.getenv("VERCEL") and not os.getenv("DB_PATH"):
    DB_PATH = Path("/tmp/zynoscript.db")
else:
    DB_PATH = Path(os.getenv("DB_PATH", str(ROOT / "data" / "zynoscript.db")))
PUBLIC_DIR = ROOT / "public"

SESSION_HOURS = int(os.getenv("SESSION_HOURS", "12"))            # how long a login token stays valid
REMEMBER_DAYS = int(os.getenv("REMEMBER_DAYS", "30"))            # lifetime when "Remember me" is ticked
MAX_SOURCE_CHARS = int(os.getenv("MAX_SOURCE_CHARS", "20000"))   # largest program accepted by the compiler endpoints
PASSWORD_MIN_LEN = int(os.getenv("PASSWORD_MIN_LEN", "6"))
LOGIN_MAX_FAILURES = int(os.getenv("LOGIN_MAX_FAILURES", "8"))           # wrong passwords allowed per username...
LOGIN_WINDOW_SECONDS = float(os.getenv("LOGIN_WINDOW_SECONDS", "300"))   # ...within this many seconds
COMPILE_MAX_PER_MINUTE = int(os.getenv("COMPILE_MAX_PER_MINUTE", "120")) # compiler API calls per user per minute
CORS_ORIGINS = [orig.strip() for orig in os.getenv("CORS_ORIGINS", "*").split(",") if orig.strip()]
DEFAULT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "").strip()
DEFAULT_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "").strip()


