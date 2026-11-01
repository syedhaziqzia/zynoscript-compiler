"""Register, sign in, sign out, who am I."""
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import logs
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
from ..config import PASSWORD_MIN_LEN, REMEMBER_DAYS, SESSION_HOURS
from ..db import connect

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=PASSWORD_MIN_LEN, max_length=128)
    remember: bool = False        # "Remember me": longer-lived session


def session_for(user_id: int, remember: bool) -> str:
    return create_session(user_id, REMEMBER_DAYS * 24 if remember else SESSION_HOURS)


@router.post("/register", status_code=201)
def register(body: Credentials):
    salt = new_salt()
    try:
        with connect() as conn:
            first = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
            cur = conn.execute("INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)",
                               (body.username, hash_password(body.password, salt), salt, "admin" if first else "user"))
            user = {"id": cur.lastrowid, "username": body.username, "role": "admin" if first else "user"}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That username is taken. Pick another one.")
    logs.record(user, "register")
    return {"token": session_for(user["id"], body.remember), "user": user}


@router.post("/login")
def login(body: Credentials):
    with connect() as conn:
        row = conn.execute("SELECT id, username, role, password_hash, salt FROM users WHERE username = ?",
                           (body.username,)).fetchone()
    if row is None:
        dummy_verify(body.password)
        logs.record(None, "login", "error", "wrong username or password", username=body.username)
        raise HTTPException(401, "Wrong username or password.")
    if not verify_password(body.password, row["salt"], row["password_hash"]):
        logs.record(None, "login", "error", "wrong username or password", username=body.username)
        raise HTTPException(401, "Wrong username or password.")

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
