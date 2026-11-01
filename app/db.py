"""SQLite access: connection helper and schema."""
import sqlite3
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
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
    user_id    INTEGER NOT NULL REFERENCES users(id),
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


@contextmanager
def connect():
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
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.executescript(SCHEMA)
