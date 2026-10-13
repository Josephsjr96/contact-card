"""
SQLite access layer for the Registry service.

Design notes:
- WAL journal mode lets readers and a writer proceed concurrently, which
  matters here because the dashboard polls GET endpoints while the
  rollback worker or a promote/rollback call may be writing.
- `get_connection()` is a lightweight connection-per-call helper with a
  busy timeout, which is the right amount of "pooling" for a SQLite-backed
  MVP; a real pool (e.g. via a queue of connections) is unnecessary
  complexity at this scale and is flagged in README as a future swap point
  when migrating to PostgreSQL.
"""
import os
import sqlite3
import contextlib
import datetime
from .config import DB_PATH


def _ensure_dir():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


@contextlib.contextmanager
def get_connection():
    _ensure_dir()
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS models (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                artifact_uri TEXT NOT NULL,
                stage TEXT NOT NULL DEFAULT 'REGISTERED',
                training_run_id TEXT,
                mlflow_run_id TEXT,
                metadata_json TEXT,
                parent_version TEXT,
                created_at TEXT NOT NULL,
                promoted_at TEXT,
                rolled_back_at TEXT,
                archived_at TEXT,
                UNIQUE(name, version)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS deployment_state (
                model_name TEXT PRIMARY KEY,
                stable_version TEXT,
                candidate_version TEXT,
                canary_percentage INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL,
                version TEXT,
                action TEXT NOT NULL,
                previous_state TEXT,
                new_state TEXT,
                timestamp TEXT NOT NULL
            )
        """)
        # Indexes: the two access patterns that matter are "find versions of
        # a named model" (lookup + list) and "read deployment state", both
        # already covered by the PK/UNIQUE constraints above; this one
        # covers audit history lookups by model name.
        conn.execute("CREATE INDEX IF NOT EXISTS idx_models_name ON models(name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_models_stage ON models(name, stage)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_model ON audit_log(model_name, timestamp)")


def now_iso() -> str:
    return datetime.datetime.utcnow().isoformat()


def record_audit(conn, model_name: str, version: str, action: str,
                  previous_state: str, new_state: str):
    conn.execute(
        "INSERT INTO audit_log (model_name, version, action, previous_state, new_state, timestamp) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (model_name, version, action, previous_state, new_state, now_iso()),
    )
