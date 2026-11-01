"""Password hashing, session tokens and the 'who is calling?' dependency."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException

from .config import SESSION_HOURS
from .db import connect

FMT = "%Y-%m-%d %H:%M:%S"
_DUMMY_SALT = "00" * 16
_DUMMY_HASH = hashlib.pbkdf2_hmac("sha256", b"dummy_password", bytes.fromhex(_DUMMY_SALT), 120_000).hex()


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
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def bearer_token(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in to continue.")
    return authorization[7:]


def current_user(token: str = Depends(bearer_token)) -> dict:
    with connect() as conn:
        row = conn.execute(
            "SELECT u.id, u.username, u.role, u.grammar_json, s.expires_at FROM sessions s "
            "JOIN users u ON u.id = s.user_id WHERE s.token = ?", (token,)).fetchone()
    if row is None or row["expires_at"] < datetime.now(timezone.utc).replace(tzinfo=None).strftime(FMT):
        raise HTTPException(401, "Your session has expired. Sign in again.")
    return dict(row)


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Only admins can do this.")
    return user
