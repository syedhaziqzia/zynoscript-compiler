"""Database access: hybrid manager supporting local SQLite and cloud PostgreSQL (Neon/Supabase)."""
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime

from .config import DB_PATH

try:
    import psycopg2
    import psycopg2.extras
    DbIntegrityError = (sqlite3.IntegrityError, psycopg2.IntegrityError)
except ImportError:
    psycopg2 = None
    DbIntegrityError = (sqlite3.IntegrityError,)

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',      -- first account becomes 'admin'
    grammar_json  TEXT,                              -- NULL = default ZynoScript grammar
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER,
    username     TEXT NOT NULL,
    action       TEXT NOT NULL,        -- login, run_lexical, grammar_update, ...
    status       TEXT NOT NULL,        -- ok / error
    detail       TEXT,
    program_hash TEXT,                 -- short hash of the source the action ran on
    program_size INTEGER,              -- number of lines in that source
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

PG_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    grammar_json  TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_log (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER,
    username     TEXT NOT NULL,
    action       TEXT NOT NULL,
    status       TEXT NOT NULL,
    detail       TEXT,
    program_hash TEXT,
    program_size INTEGER,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def _normalize_pg_val(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    return v


class PgRowWrapper(dict):
    """Wraps psycopg2 DictRow so both dict keys, index lookups, and dict(row) work."""
    def __init__(self, raw_row):
        super().__init__()
        self._raw = raw_row
        if raw_row:
            for k in raw_row.keys():
                self[k] = _normalize_pg_val(raw_row[k])

    def __getitem__(self, item):
        if isinstance(item, int):
            return _normalize_pg_val(self._raw[item])
        return super().__getitem__(item)


class PgCursorWrapper:
    def __init__(self, raw_cur):
        self._cur = raw_cur
        self.lastrowid = None

    def execute(self, sql, args=None):
        pg_sql = sql.replace("?", "%s")
        is_insert = pg_sql.strip().upper().startswith("INSERT")
        upper = pg_sql.upper()
        # Only append RETURNING id for tables that have an id primary key (e.g. users, activity_log)
        # Avoid appending to tables like 'sessions' which use 'token' as primary key.
        if is_insert and "RETURNING" not in upper:
            if "USERS" in upper or "ACTIVITY_LOG" in upper:
                pg_sql += " RETURNING id"

        self._cur.execute(pg_sql, args or ())
        if is_insert and self._cur.description:
            row = self._cur.fetchone()
            if row:
                self.lastrowid = row[0]
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return PgRowWrapper(row) if row is not None else None

    def fetchall(self):
        rows = self._cur.fetchall()
        return [PgRowWrapper(r) for r in rows]

    def __iter__(self):
        for r in self._cur:
            yield PgRowWrapper(r)


class PgConnectionWrapper:
    def __init__(self, raw_conn):
        self._conn = raw_conn

    def execute(self, sql, args=None):
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        wrapped = PgCursorWrapper(cur)
        return wrapped.execute(sql, args)

    def executescript(self, script):
        with self._conn.cursor() as cur:
            cur.execute(script)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_database_url() -> str:
    candidates = [
        os.getenv("DATABASE_URL", ""),
        os.getenv("POSTGRES_URL", ""),
        os.getenv("POSTGRES_URL_NON_POOLING", ""),
        os.getenv("DATABASE_URL_UNPOOLED", ""),
    ]

    for raw in candidates:
        if not raw:
            continue
        raw_str = raw.strip()
        # Handle cases where full multi-line .env content or commented lines were pasted into Vercel
        for line in raw_str.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            for prefix in ("DATABASE_URL=", "POSTGRES_URL=", "POSTGRES_URL_NON_POOLING=", "DATABASE_URL_UNPOOLED="):
                if line.startswith(prefix):
                    line = line[len(prefix):].strip()
                    break
            if (line.startswith('"') and line.endswith('"')) or (line.startswith("'") and line.endswith("'")):
                line = line[1:-1].strip()
            if "postgresql://" in line or "postgres://" in line:
                m = re.search(r'(postgres(?:ql)?://[^\s"\'>]+)', line)
                if m:
                    candidate = m.group(1)
                    if candidate.startswith("postgres://"):
                        candidate = "postgresql://" + candidate[len("postgres://"):]
                    if " #" in candidate:
                        candidate = candidate.split(" #")[0].strip()
                    if "sslmode" not in candidate and ("neon.tech" in candidate or "supabase" in candidate):
                        sep = "&" if "?" in candidate else "?"
                        candidate += f"{sep}sslmode=require"
                    return candidate

        # Regex fallback across the entire raw string if not split cleanly
        m = re.search(r'(postgres(?:ql)?://[^\s"\'>]+)', raw_str)
        if m:
            candidate = m.group(1)
            if candidate.startswith("postgres://"):
                candidate = "postgresql://" + candidate[len("postgres://"):]
            if " #" in candidate:
                candidate = candidate.split(" #")[0].strip()
            if "sslmode" not in candidate and ("neon.tech" in candidate or "supabase" in candidate):
                sep = "&" if "?" in candidate else "?"
                candidate += f"{sep}sslmode=require"
            return candidate

    return ""


_db_initialized = False


def ensure_db():
    global _db_initialized
    if not _db_initialized:
        init_db()
        _db_initialized = True


@contextmanager
def connect():
    ensure_db()
    db_url = get_database_url()
    if db_url and psycopg2 is not None:
        try:
            raw_conn = psycopg2.connect(db_url, connect_timeout=10)
            wrapped = PgConnectionWrapper(raw_conn)
            try:
                yield wrapped
                wrapped.commit()
            finally:
                wrapped.close()
            return
        except Exception as pg_err:
            print(f"Warning: PostgreSQL connection failed ({pg_err}), falling back to SQLite: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def seed_admin_user(conn_or_cur, is_pg: bool = False):
    from .auth import hash_password, new_salt
    from .config import DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME

    try:
        if is_pg:
            conn_or_cur.execute("SELECT id FROM users WHERE username = %s", (DEFAULT_ADMIN_USERNAME,))
            if not conn_or_cur.fetchone():
                salt = new_salt()
                pwd_hash = hash_password(DEFAULT_ADMIN_PASSWORD, salt)
                conn_or_cur.execute(
                    "INSERT INTO users (username, password_hash, salt, role) VALUES (%s, %s, %s, 'admin')",
                    (DEFAULT_ADMIN_USERNAME, pwd_hash, salt)
                )
            # Demote any accidental admin accounts that are not DEFAULT_ADMIN_USERNAME
            conn_or_cur.execute(
                "UPDATE users SET role = 'user' WHERE username != %s AND role = 'admin'",
                (DEFAULT_ADMIN_USERNAME,)
            )
        else:
            cur = conn_or_cur.execute("SELECT id FROM users WHERE username = ?", (DEFAULT_ADMIN_USERNAME,))
            if not cur.fetchone():
                salt = new_salt()
                pwd_hash = hash_password(DEFAULT_ADMIN_PASSWORD, salt)
                conn_or_cur.execute(
                    "INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'admin')",
                    (DEFAULT_ADMIN_USERNAME, pwd_hash, salt)
                )
            conn_or_cur.execute(
                "UPDATE users SET role = 'user' WHERE username != ? AND role = 'admin'",
                (DEFAULT_ADMIN_USERNAME,)
            )
    except Exception as e:
        print(f"Warning: seed_admin_user failed: {e}")


def init_db():
    db_url = get_database_url()
    if db_url and psycopg2 is not None:
        try:
            with psycopg2.connect(db_url, connect_timeout=10) as conn:
                with conn.cursor() as cur:
                    cur.execute(PG_SCHEMA)
                    seed_admin_user(cur, is_pg=True)
                conn.commit()
            return
        except Exception as e:
            print(f"Warning: PostgreSQL schema initialization error: {e}")

    try:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.executescript(SQLITE_SCHEMA)
        seed_admin_user(conn, is_pg=False)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Warning: SQLite schema initialization error: {e}")

