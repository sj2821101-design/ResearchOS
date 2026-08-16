"""SQLite 索引层（stdlib sqlite3，无额外依赖）。

定位：SQLite 只做"索引/检索/列表"，论文的完整工件（PDF、extracted_text.md、
analysis.json、notes.md、figures/）以文件形式存放在 data/papers/<id>/ 下。
索引与文件互为冗余：索引便于快速列表与搜索，文件便于人直接阅读与迁移。
"""
from __future__ import annotations

import json
import sqlite3
import threading
from typing import Any, Dict, List, Optional

from .config import settings

_lock = threading.Lock()


def _db_path() -> str:
    return str(settings.data_dir / "researchos.db")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db() -> None:
    settings.ensure_dirs()
    with _lock:
        conn = get_conn()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS papers (
                    id                TEXT PRIMARY KEY,
                    filename          TEXT,
                    title             TEXT,
                    authors           TEXT,   -- JSON array
                    year              INTEGER,
                    venue             TEXT,
                    doi               TEXT,
                    keywords          TEXT,   -- JSON array
                    section_count     INTEGER,
                    analysis_status   TEXT DEFAULT 'none',
                    analysis_provider TEXT,
                    analysis_model    TEXT,
                    created_at        TEXT
                )
                """
            )
            conn.commit()
        finally:
            conn.close()


def _dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)


def _loads(raw: Optional[str], default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


def upsert_paper(paper_id: str, filename: str, meta: Dict[str, Any], created_at: str) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute(
                """
                INSERT INTO papers
                    (id, filename, title, authors, year, venue, doi, keywords, section_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(id) DO UPDATE SET
                    filename = excluded.filename,
                    title = excluded.title,
                    authors = excluded.authors,
                    year = excluded.year,
                    venue = excluded.venue,
                    doi = excluded.doi,
                    keywords = excluded.keywords
                """,
                (
                    paper_id,
                    filename,
                    meta.get("title"),
                    _dumps(meta.get("authors", [])),
                    meta.get("year"),
                    meta.get("venue"),
                    meta.get("doi"),
                    _dumps(meta.get("keywords", [])),
                    created_at,
                ),
            )
            conn.commit()
        finally:
            conn.close()


def set_section_count(paper_id: str, count: int) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute("UPDATE papers SET section_count = ? WHERE id = ?", (count, paper_id))
            conn.commit()
        finally:
            conn.close()


def set_analysis_status(paper_id: str, status: str, provider: Optional[str] = None, model: Optional[str] = None) -> None:
    with _lock:
        conn = get_conn()
        try:
            conn.execute(
                "UPDATE papers SET analysis_status = ?, analysis_provider = ?, analysis_model = ? WHERE id = ?",
                (status, provider, model, paper_id),
            )
            conn.commit()
        finally:
            conn.close()


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    d["authors"] = _loads(d.get("authors"), [])
    d["keywords"] = _loads(d.get("keywords"), [])
    return d


def list_papers() -> List[Dict[str, Any]]:
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM papers ORDER BY created_at DESC, id DESC").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_paper(paper_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM papers WHERE id = ?", (paper_id,)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def search_papers(query: str) -> List[Dict[str, Any]]:
    like = f"%{query}%"
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM papers WHERE title LIKE ? OR authors LIKE ? OR keywords LIKE ? ORDER BY created_at DESC",
            (like, like, like),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()
