"""论文导入流水线：PDF -> 解析 -> 结构化 -> 落盘 -> 入库。"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from .. import db
from ..store import store
from . import pdf_parser, structure


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def ingest_pdf(filename: str, content: bytes) -> Dict[str, Any]:
    paper_id = store.next_id()
    path = store.save_pdf(paper_id, filename, content)

    parsed = pdf_parser.extract_pdf(paper_id, path)
    meta = structure.extract_metadata(parsed["text"], parsed["pdf_meta"])
    sections = structure.detect_sections(parsed["text"])

    store.write_json(paper_id, "metadata.json", meta)
    store.write_json(paper_id, "sections.json", sections)
    store.write_text(paper_id, "extracted_text.md", parsed["text"])

    db.upsert_paper(paper_id, path.name, meta, _now())
    db.set_section_count(paper_id, len(sections))

    return {
        "id": paper_id,
        "filename": path.name,
        "metadata": meta,
        "num_pages": parsed["num_pages"],
        "num_sections": len(sections),
        "num_figures": parsed["num_figures"],
        "title": meta.get("title", ""),
    }
