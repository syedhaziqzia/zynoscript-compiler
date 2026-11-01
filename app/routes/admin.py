"""Admin tools: user list, reset a password, change a role, delete a user. Every route needs the admin role."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import logs
from ..auth import hash_password, new_salt, require_admin
from ..config import PASSWORD_MIN_LEN
from ..db import connect

router = APIRouter(prefix="/api/admin", tags=["admin"])


class NewPassword(BaseModel):
    password: str = Field(min_length=PASSWORD_MIN_LEN, max_length=128)


class NewRole(BaseModel):
    role: Literal["admin", "user"]


def find_user(conn, user_id: int):
    row = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "That user does not exist.")
    return row


@router.get("/users")
def list_users(_admin: dict = Depends(require_admin)):
    with connect() as conn:
        rows = conn.execute(
            "SELECT u.id, u.username, u.role, u.created_at, "
            "(SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.action LIKE 'run\\_%' ESCAPE '\\') AS runs, "
            "(SELECT MAX(created_at) FROM activity_log a WHERE a.user_id = u.id) AS last_active "
            "FROM users u ORDER BY u.id").fetchall()
    return {"users": [dict(r) for r in rows]}


@router.post("/users/{user_id}/password")
def reset_password(user_id: int, body: NewPassword, admin: dict = Depends(require_admin)):
    salt = new_salt()
    with connect() as conn:
        target = find_user(conn, user_id)
        conn.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (hash_password(body.password, salt), salt, user_id))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))      # signs that user out everywhere
    logs.record(admin, "admin_reset_password", detail=f"user: {target['username']}")
    return {"ok": True}


@router.post("/users/{user_id}/role")
def set_role(user_id: int, body: NewRole, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(409, "You cannot change your own role.")
    with connect() as conn:
        target = find_user(conn, user_id)
        conn.execute("UPDATE users SET role = ? WHERE id = ?", (body.role, user_id))
    logs.record(admin, "admin_set_role", detail=f"user: {target['username']} -> {body.role}")
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(409, "You cannot delete your own account.")
    with connect() as conn:
        target = find_user(conn, user_id)
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))             # their log rows are kept for the record
    logs.record(admin, "admin_delete_user", detail=f"user: {target['username']}")
    return {"ok": True}
