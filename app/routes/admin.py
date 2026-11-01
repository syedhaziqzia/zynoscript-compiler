"""Admin tools: user list, reset a password, change a role, delete a user, telemetry, grammar management, log pruning."""
import json
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import logs
from ..auth import hash_password, new_salt, require_admin
from ..config import PASSWORD_MIN_LEN
from ..db import connect, get_active_db_type
from ..engines import grammar as G

router = APIRouter(prefix="/api/admin", tags=["admin"])


class NewPassword(BaseModel):
    password: str = Field(min_length=PASSWORD_MIN_LEN, max_length=128)


class NewRole(BaseModel):
    role: Literal["admin", "user"]


class PruneLogs(BaseModel):
    days: int = Field(default=0, ge=0)


def find_user(conn, user_id: int):
    row = conn.execute("SELECT id, username, role, grammar_json FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "That user does not exist.")
    return dict(row)



@router.get("/users")
def list_users(_admin: dict = Depends(require_admin)):
    with connect() as conn:
        rows = conn.execute(
            "SELECT u.id, u.username, u.role, u.created_at, "
            "(SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.action LIKE ?) AS runs, "
            "(SELECT MAX(created_at) FROM activity_log a WHERE a.user_id = u.id) AS last_active, "
            "CASE WHEN u.grammar_json IS NOT NULL THEN 1 ELSE 0 END AS has_custom_grammar "
            "FROM users u ORDER BY u.id", ("run_%",)).fetchall()
    return {"users": [dict(r) for r in rows]}


@router.get("/telemetry")
def get_telemetry(_admin: dict = Depends(require_admin)):
    with connect() as conn:
        stats = conn.execute(
            "SELECT "
            "(SELECT COUNT(*) FROM users) AS total_users, "
            "(SELECT COUNT(*) FROM users WHERE role = 'admin') AS admin_users, "
            "(SELECT COUNT(*) FROM users WHERE role = 'user') AS regular_users, "
            "(SELECT COUNT(*) FROM activity_log WHERE action LIKE ?) AS total_runs, "
            "(SELECT COUNT(*) FROM activity_log WHERE action LIKE ? AND status = 'ok') AS total_success, "
            "(SELECT COUNT(*) FROM activity_log WHERE action LIKE ? AND status = 'error') AS total_errors, "
            "(SELECT COUNT(*) FROM sessions) AS active_sessions, "
            "(SELECT COUNT(*) FROM activity_log) AS total_logs",
            ("run_%", "run_%", "run_%")
        ).fetchone()

        stage_rows = conn.execute(
            "SELECT action, COUNT(*) AS count FROM activity_log WHERE action LIKE ? GROUP BY action",
            ("run_%",)
        ).fetchall()


    breakdown = {
        "lexical": 0,
        "syntax": 0,
        "semantic": 0,
        "icg": 0,
        "output": 0,
    }
    for r in stage_rows:
        act = r["action"]
        key = act.replace("run_", "")
        breakdown[key] = r["count"]

    s_dict = dict(stats) if stats else {}
    tot_runs = s_dict.get("total_runs", 0)
    tot_success = s_dict.get("total_success", 0)
    success_rate = round((tot_success / tot_runs) * 100, 1) if tot_runs > 0 else 100.0

    return {
        "telemetry": {
            **s_dict,
            "success_rate_pct": success_rate,
            "stages": breakdown,
            "db_backend": get_active_db_type(),
        }
    }


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


@router.get("/users/{user_id}/grammar")
def get_user_grammar(user_id: int, _admin: dict = Depends(require_admin)):
    with connect() as conn:
        target = find_user(conn, user_id)
    gram = json.loads(target["grammar_json"]) if target.get("grammar_json") else G.default()
    return {
        "username": target["username"],
        "has_custom": bool(target.get("grammar_json")),
        "grammar": gram,
    }


@router.post("/users/{user_id}/grammar/reset")
def reset_user_grammar(user_id: int, admin: dict = Depends(require_admin)):
    with connect() as conn:
        target = find_user(conn, user_id)
        conn.execute("UPDATE users SET grammar_json = NULL WHERE id = ?", (user_id,))
    logs.record(admin, "admin_reset_user_grammar", detail=f"user: {target['username']}")
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


@router.post("/logs/prune")
def prune_logs(body: PruneLogs, admin: dict = Depends(require_admin)):
    with connect() as conn:
        if body.days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=body.days)).strftime("%Y-%m-%d %H:%M:%S")
            conn.execute("DELETE FROM activity_log WHERE created_at < ?", (cutoff,))
            detail = f"Pruned logs older than {body.days} days"
        else:
            conn.execute("DELETE FROM activity_log")
            detail = "Cleared all activity logs"
    logs.record(admin, "admin_clear_logs", detail=detail)
    return {"ok": True, "detail": detail}

