"""Database access: hybrid manager supporting local SQLite and cloud PostgreSQL (Neon/Supabase)."""
import os
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
        if is_insert and "RETURNING" not in pg_sql.upper():
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
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


@contextmanager
def connect():
    db_url = get_database_url()
    if db_url and psycopg2 is not None:
        raw_conn = psycopg2.connect(db_url)
        wrapped = PgConnectionWrapper(raw_conn)
        try:
            yield wrapped
            wrapped.commit()
        finally:
            wrapped.close()
    else:
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def init_db():
    db_url = get_database_url()
    if db_url and psycopg2 is not None:
        with psycopg2.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(PG_SCHEMA)
            conn.commit()
    else:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with connect() as conn:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.executescript(SQLITE_SCHEMA)
