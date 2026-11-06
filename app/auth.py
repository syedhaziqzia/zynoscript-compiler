"""Password hashing, session tokens and the 'who is calling?' dependency."""
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException

from .config import SESSION_HOURS
from .db import connect

FMT = "%Y-%m-%d %H:%M:%S"
_DUMMY_SALT = "00" * 16
_DUMMY_HASH = hashlib.pbkdf2_hmac("sha256", b"dummy_password", bytes.fromhex(_DUMMY_SALT), 120_000).hex()

# In-memory session validation cache to eliminate database lookups on repeated compiler requests
_SESSION_CACHE: dict[str, tuple[dict, float]] = {}
_SESSION_CACHE_TTL = 180.0  # 3 minutes


def invalidate_session_cache(token: str | None = None, user_id: int | None = None):
    global _SESSION_CACHE
    if token:
        _SESSION_CACHE.pop(token, None)
    elif user_id is not None:
        _SESSION_CACHE = {t: v for t, v in _SESSION_CACHE.items() if v[0].get("id") != user_id}
    else:
        _SESSION_CACHE.clear()


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 120_000).hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    actual = hash_password(password, salt)
    return secrets.compare_digest(actual, expected_hash)


def dummy_verify(password: str):
    """Runs a realistic hash calculation to prevent timing-based username enumeration."""
    verify_password(password, _DUMMY_SALT, _DUMMY_HASH)


def new_salt() -> str:
    return secrets.token_hex(16)


def purge_expired_sessions():
    """Deletes sessions whose expires_at is in the past."""
    now_str = datetime.now(timezone.utc).replace(tzinfo=None).strftime(FMT)
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now_str,))


def create_session(user_id: int, hours: int = SESSION_HOURS) -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=hours)).strftime(FMT)
    with connect() as conn:
        conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires))
    return token


def delete_session(token: str):
    invalidate_session_cache(token=token)
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def bearer_token(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in to continue.")
    return authorization[7:]


def current_user(token: str = Depends(bearer_token)) -> dict:
    now_ts = time.time()
    now_utc_str = datetime.now(timezone.utc).replace(tzinfo=None).strftime(FMT)
    cached = _SESSION_CACHE.get(token)
    if cached is not None:
        user_data, cache_exp = cached
        if now_ts < cache_exp and user_data.get("expires_at", "") >= now_utc_str:
            return user_data
        _SESSION_CACHE.pop(token, None)

    with connect() as conn:
        row = conn.execute(
            "SELECT u.id, u.username, u.role, u.grammar_json, s.expires_at FROM sessions s "
            "JOIN users u ON u.id = s.user_id WHERE s.token = ?", (token,)).fetchone()
    if row is None or row["expires_at"] < now_utc_str:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    res = dict(row)
    _SESSION_CACHE[token] = (res, now_ts + _SESSION_CACHE_TTL)
    return res


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Only admins can do this.")
    return user
