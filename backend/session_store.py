"""Persistent session store backed by SQLite.

Provides the same dict-like interface as the old in-memory `sessions`,
but writes every mutation to disk so data survives backend restarts.
"""

from __future__ import annotations

import json
import sqlite3
import os
from typing import Iterator

from backend.config import OUTPUT_BASE

DB_PATH = os.path.join(os.path.dirname(OUTPUT_BASE), "sessions.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


class SessionStore:
    """Dict-like wrapper that auto-persists to SQLite."""

    def __init__(self) -> None:
        self._conn = _get_conn()
        self._cache: dict[str, dict] = {}
        self._load_all()

    def _load_all(self) -> None:
        cursor = self._conn.execute("SELECT session_id, data FROM sessions")
        for sid, raw in cursor.fetchall():
            try:
                self._cache[sid] = json.loads(raw)
            except json.JSONDecodeError:
                pass

    def _persist(self, session_id: str) -> None:
        data = self._cache.get(session_id)
        if data is None:
            return
        raw = json.dumps(data, ensure_ascii=False, default=str)
        self._conn.execute(
            "INSERT OR REPLACE INTO sessions (session_id, data) VALUES (?, ?)",
            (session_id, raw),
        )
        self._conn.commit()

    def __contains__(self, session_id: str) -> bool:
        return session_id in self._cache

    def __getitem__(self, session_id: str) -> dict:
        return self._cache[session_id]

    def __setitem__(self, session_id: str, value: dict) -> None:
        self._cache[session_id] = value
        self._persist(session_id)

    def get(self, session_id: str, default=None):
        return self._cache.get(session_id, default)

    def __iter__(self) -> Iterator[str]:
        return iter(self._cache)

    def __len__(self) -> int:
        return len(self._cache)

    def save(self, session_id: str) -> None:
        """Explicitly persist current state for a session."""
        self._persist(session_id)

    def delete(self, session_id: str) -> None:
        self._cache.pop(session_id, None)
        self._conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        self._conn.commit()
