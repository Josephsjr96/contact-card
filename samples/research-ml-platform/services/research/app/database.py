"""
SQLite access layer for the Research service (translations, human ratings,
discussion board, and derived analytics). Same WAL/indexing approach as the
Registry service -- see that service's database.py for the rationale.
"""
import os
import json
import sqlite3
import contextlib
import datetime
import statistics
from typing import Optional, Dict, List
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
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS translations (
                id TEXT PRIMARY KEY,
                source_text TEXT NOT NULL,
                source_lang TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                nllb_translation TEXT,
                m2m_translation TEXT,
                model_version TEXT,
                traffic_group TEXT,
                metrics_json TEXT,
                poetic_features_json TEXT,
                timestamp TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ratings (
                rating_id TEXT PRIMARY KEY,
                translation_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                model_preference TEXT,
                fluency_score INTEGER,
                poetic_preservation_score INTEGER,
                cultural_accuracy_score INTEGER,
                comments TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (translation_id) REFERENCES translations(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS discussions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project TEXT NOT NULL,
                user_id TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_translations_ts ON translations(timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ratings_translation ON ratings(translation_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_discussions_project ON discussions(project, timestamp)")


def now_iso() -> str:
    return datetime.datetime.utcnow().isoformat()


def save_translation(t: dict) -> str:
    translation_id = f"trans_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO translations (id, source_text, source_lang, target_lang, "
            "nllb_translation, m2m_translation, model_version, traffic_group, "
            "metrics_json, poetic_features_json, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (translation_id, t["source_text"], t["source_lang"], t["target_lang"],
             t.get("nllb_translation"), t.get("m2m_translation"), t.get("model_version"),
             t.get("traffic_group"), json.dumps(t.get("metrics") or {}),
             json.dumps(t.get("poetic_features") or {}), now_iso()),
        )
    return translation_id


def list_translations(limit: int = 200) -> List[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM translations ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        return [_translation_row(r) for r in rows]


def get_translation(translation_id: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM translations WHERE id = ?", (translation_id,)).fetchone()
        return _translation_row(row) if row else None


def save_rating(r: dict) -> str:
    rating_id = f"rate_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO ratings (rating_id, translation_id, user_id, model_preference, "
            "fluency_score, poetic_preservation_score, cultural_accuracy_score, comments, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (rating_id, r["translation_id"], r["user_id"], r.get("model_preference"),
             r.get("fluency_score"), r.get("poetic_preservation_score"),
             r.get("cultural_accuracy_score"), r.get("comments"), now_iso()),
        )
    return rating_id


def list_ratings(limit: int = 200) -> List[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM ratings ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def save_discussion_message(project: str, user_id: str, message: str) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO discussions (project, user_id, message, timestamp) VALUES (?, ?, ?, ?)",
            (project, user_id, message, now_iso()),
        )
        return cur.lastrowid


def list_discussion(project: str, limit: int = 100) -> List[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM discussions WHERE project = ? ORDER BY timestamp ASC LIMIT ?",
            (project, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def summary_stats() -> Dict:
    translations = list_translations(limit=10000)
    ratings = list_ratings(limit=10000)

    poetic_scores = []
    for t in translations:
        pf = t.get("poetic_features") or {}
        for key in ("nllb_output", "m2m_output"):
            if key in pf and "poetic_score" in pf[key]:
                poetic_scores.append(pf[key]["poetic_score"])

    preference_counts = {"nllb": 0, "m2m": 0, "equal": 0, "neither": 0}
    cultural_scores = []
    for r in ratings:
        pref = (r.get("model_preference") or "").lower()
        if pref in preference_counts:
            preference_counts[pref] += 1
        if r.get("cultural_accuracy_score") is not None:
            cultural_scores.append(r["cultural_accuracy_score"])

    total_ratings = len(ratings) or 1

    return {
        "total_translations": len(translations),
        "total_ratings": len(ratings),
        "avg_poetic_score": statistics.mean(poetic_scores) if poetic_scores else 0.0,
        "nllb_preferred_pct": 100 * preference_counts["nllb"] / total_ratings,
        "m2m_preferred_pct": 100 * preference_counts["m2m"] / total_ratings,
        "equal_pct": 100 * preference_counts["equal"] / total_ratings,
        "neither_pct": 100 * preference_counts["neither"] / total_ratings,
        "avg_cultural_accuracy": statistics.mean(cultural_scores) if cultural_scores else 0.0,
        "poetic_scores": poetic_scores,
    }


def _translation_row(row) -> dict:
    d = dict(row)
    d["metrics"] = json.loads(d.pop("metrics_json") or "{}")
    d["poetic_features"] = json.loads(d.pop("poetic_features_json") or "{}")
    return d
