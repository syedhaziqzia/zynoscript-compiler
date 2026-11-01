"""Activity log: who did what, on which program."""
import hashlib

from .db import connect


def record(user: dict | None, action: str, status: str = "ok", detail: str = "", source: str | None = None,
           username: str | None = None):
    program_hash = program_size = None
    if source is not None:
        program_hash = hashlib.sha1(source.encode()).hexdigest()[:8]
        program_size = len(source.splitlines())
    with connect() as conn:
        conn.execute(
            "INSERT INTO activity_log (user_id, username, action, status, detail, program_hash, program_size) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user["id"] if user else None, user["username"] if user else (username or "anonymous"),
             action, status, detail, program_hash, program_size))


def fetch(user: dict, limit: int = 200, action: str = "", username: str = "", status: str = ""):
    sql, args = "SELECT * FROM activity_log WHERE 1=1", []
    if user["role"] != "admin":                       # normal users only see their own history
        sql += " AND user_id = ?"; args.append(user["id"])
    elif username:
        sql += " AND username = ?"; args.append(username)
    if action:
        sql += " AND action = ?"; args.append(action)
    if status:
        sql += " AND status = ?"; args.append(status)
    sql += " ORDER BY id DESC LIMIT ?"; args.append(max(1, min(limit, 1000)))
    with connect() as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]

