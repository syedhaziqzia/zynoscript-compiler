"""Register, sign in, sign out, who am I."""
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import logs, ratelimit
from ..auth import (
    bearer_token,
    create_session,
    current_user,
    delete_session,
    dummy_verify,
    hash_password,
    new_salt,
    purge_expired_sessions,
    verify_password,
)
from ..config import (
    DEFAULT_ADMIN_USERNAME,
    LOGIN_MAX_FAILURES,
    LOGIN_WINDOW_SECONDS,
    PASSWORD_MIN_LEN,
    REMEMBER_DAYS,
    SESSION_HOURS,
)
from ..db import DbIntegrityError, connect

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=PASSWORD_MIN_LEN, max_length=128)
    remember: bool = False        # "Remember me": longer-lived session


def session_for(user_id: int, remember: bool) -> str:
    return create_session(user_id, REMEMBER_DAYS * 24 if remember else SESSION_HOURS)


@router.post("/register", status_code=201)
def register(body: Credentials):
    if DEFAULT_ADMIN_USERNAME and body.username.lower() == DEFAULT_ADMIN_USERNAME.lower():
        raise HTTPException(
            status_code=400,
            detail=f"The username '{body.username}' is reserved for system administration. Please choose a different username."
        )
    salt = new_salt()
    try:
        with connect() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'user')",
                (body.username, hash_password(body.password, salt), salt)
            )
            user = {"id": cur.lastrowid, "username": body.username, "role": "user"}
    except DbIntegrityError:
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"Username '{body.username}' is already registered. Did you mean to sign in?",
                "action": "login",
                "username": body.username
            }
        )
    logs.record(user, "register")
    return {"token": session_for(user["id"], body.remember), "user": user}


@router.post("/login")
def login(body: Credentials):
    throttle_key = f"login-fail:{body.username.lower()}"
    if ratelimit.blocked(throttle_key, LOGIN_MAX_FAILURES, LOGIN_WINDOW_SECONDS):
        raise HTTPException(429, f"Too many failed sign-in attempts for '{body.username}'. Wait a few minutes and try again.")
    with connect() as conn:
        row = conn.execute("SELECT id, username, role, password_hash, salt FROM users WHERE username = ?",
                           (body.username,)).fetchone()
    if row is None:
        dummy_verify(body.password)
        logs.record(None, "login", "error", "user not found", username=body.username)
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No account found with username '{body.username}'. Would you like to create one?",
                "action": "register",
                "username": body.username
            }
        )
    if not verify_password(body.password, row["salt"], row["password_hash"]):
        ratelimit.hit(throttle_key, LOGIN_MAX_FAILURES, LOGIN_WINDOW_SECONDS)
        logs.record(None, "login", "error", "wrong password", username=body.username)
        raise HTTPException(
            status_code=401,
            detail={
                "message": f"Incorrect password for '{body.username}'. Please check your password and try again.",
                "action": "retry_password",
                "username": body.username
            }
        )

    try:
        purge_expired_sessions()
    except Exception:
        pass

    user = {"id": row["id"], "username": row["username"], "role": row["role"]}
    logs.record(user, "login")
    return {"token": session_for(user["id"], body.remember), "user": user}


@router.post("/logout")
def logout(user: dict = Depends(current_user), token: str = Depends(bearer_token)):
    delete_session(token)
    logs.record(user, "logout")
    return {"ok": True}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return {"id": user["id"], "username": user["username"], "role": user["role"]}
