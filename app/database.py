"""SQLite persistence layer for DevOps Incident and Task Management."""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Optional

from app.config import DATABASE_PATH


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Provide a transactional database connection with row factory."""
    conn = sqlite3.connect(DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables with schema migrations."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                priority TEXT NOT NULL DEFAULT 'P2',
                category TEXT NOT NULL DEFAULT 'General',
                done INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS service_probes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'UNKNOWN',
                latency_ms REAL NOT NULL DEFAULT 0.0,
                last_checked_at TEXT
            );
        """)


def row_to_todo_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert a SQLite Row into a dictionary conforming to Todo model."""
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"] or "",
        "priority": row["priority"],
        "category": row["category"],
        "done": bool(row["done"]),
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
    }


def list_todos() -> List[Dict[str, Any]]:
    """Retrieve all tasks ordered by status and creation time."""
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT * FROM todos ORDER BY done ASC, id DESC;"
        )
        return [row_to_todo_dict(row) for row in cursor.fetchall()]


def get_todo(todo_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve a single task by its ID."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM todos WHERE id = ?;", (todo_id,))
        row = cursor.fetchone()
        return row_to_todo_dict(row) if row else None


def create_todo(
    title: str,
    description: str = "",
    priority: str = "P2",
    category: str = "General",
) -> Dict[str, Any]:
    """Create a new task/incident."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO todos (title, description, priority, category, done, created_at)
            VALUES (?, ?, ?, ?, 0, ?);
            """,
            (title, description, priority, category, now_iso),
        )
        new_id = cursor.lastrowid
    return get_todo(new_id)  # type: ignore[return-value]


def update_todo(
    todo_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    done: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update existing task fields and set completed_at timestamp if done."""
    existing = get_todo(todo_id)
    if not existing:
        return None

    new_title = title if title is not None else existing["title"]
    new_desc = description if description is not None else existing["description"]
    new_priority = priority if priority is not None else existing["priority"]
    new_cat = category if category is not None else existing["category"]
    new_done = done if done is not None else existing["done"]

    completed_at = existing["completed_at"]
    if done is not None:
        if done and not existing["done"]:
            completed_at = datetime.now(timezone.utc).isoformat()
        elif not done:
            completed_at = None

    with get_db() as conn:
        conn.execute(
            """
            UPDATE todos
            SET title = ?, description = ?, priority = ?, category = ?, done = ?, completed_at = ?
            WHERE id = ?;
            """,
            (
                new_title,
                new_desc,
                new_priority,
                new_cat,
                1 if new_done else 0,
                completed_at,
                todo_id,
            ),
        )

    return get_todo(todo_id)


def delete_todo(todo_id: int) -> bool:
    """Delete a task by ID. Returns True if deleted, False if not found."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM todos WHERE id = ?;", (todo_id,))
        return cursor.rowcount > 0


def reset_store() -> None:
    """Clear all records from database. Used in unit tests."""
    with get_db() as conn:
        conn.execute("DELETE FROM todos;")
        conn.execute("DELETE FROM service_probes;")
        conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('todos', 'service_probes');")


# --- Service Probe Operations ---
def list_probes() -> List[Dict[str, Any]]:
    """List all registered service health probes."""
    with get_db() as conn:
        cursor = conn.execute("SELECT * FROM service_probes ORDER BY id ASC;")
        return [dict(row) for row in cursor.fetchall()]


def create_probe(name: str, url: str) -> Dict[str, Any]:
    """Register a new service probe."""
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO service_probes (name, url, status) VALUES (?, ?, 'PENDING');",
            (name, url),
        )
        new_id = cursor.lastrowid
        cursor = conn.execute("SELECT * FROM service_probes WHERE id = ?;", (new_id,))
        return dict(cursor.fetchone())


def update_probe_result(probe_id: int, status: str, latency_ms: float) -> Optional[Dict[str, Any]]:
    """Update probe health status and latency measurement."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute(
            """
            UPDATE service_probes
            SET status = ?, latency_ms = ?, last_checked_at = ?
            WHERE id = ?;
            """,
            (status, latency_ms, now_iso, probe_id),
        )
        cursor = conn.execute("SELECT * FROM service_probes WHERE id = ?;", (probe_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_probe(probe_id: int) -> bool:
    """Delete a service probe."""
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM service_probes WHERE id = ?;", (probe_id,))
        return cursor.rowcount > 0
