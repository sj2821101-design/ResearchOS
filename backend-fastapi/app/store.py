"""论文工件存储层：负责 data/papers/<id>/ 目录下的文件读写。

目录结构（与会话约定一致）：
    data/papers/paper_001/
    ├── paper.pdf          原始 PDF
    ├── metadata.json      元数据（标题/作者/年份/venue/doi/关键词）
    ├── extracted_text.md  提取的全文与章节文本
    ├── analysis.json      结构化分析结果（16 段模板 + 天基物联网字段）
    ├── figures/           抽取出的图片
    └── notes.md           用户自己的研究笔记（模板第 16 段）
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import settings
from . import db


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class PaperStore:
    def __init__(self) -> None:
        self.root = settings.data_dir / "papers"
        self.root.mkdir(parents=True, exist_ok=True)

    # ---------- id 管理 ----------
    def next_id(self) -> str:
        nums: List[int] = []
        for d in self.root.iterdir():
            if d.is_dir() and d.name.startswith("paper_"):
                tail = d.name.split("_", 1)[1]
                if tail.isdigit():
                    nums.append(int(tail))
        return f"paper_{max(nums, default=0) + 1:03d}"

    def paper_dir(self, paper_id: str) -> Path:
        d = self.root / paper_id
        d.mkdir(parents=True, exist_ok=True)
        return d

    def exists(self, paper_id: str) -> bool:
        return (self.root / paper_id).is_dir()

    # ---------- 文件写入 ----------
    def save_pdf(self, paper_id: str, filename: str, content: bytes) -> Path:
        d = self.paper_dir(paper_id)
        safe = re.sub(r"[^\w.\-]+", "_", filename) or "paper.pdf"
        if not safe.lower().endswith(".pdf"):
            safe += ".pdf"
        path = d / safe
        path.write_bytes(content)
        (d / "figures").mkdir(exist_ok=True)
        return path

    def write_json(self, paper_id: str, name: str, data: Any) -> Path:
        path = self.paper_dir(paper_id) / name
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def write_text(self, paper_id: str, name: str, text: str) -> Path:
        path = self.paper_dir(paper_id) / name
        path.write_text(text, encoding="utf-8")
        return path

    # ---------- 文件读取 ----------
    def read_json(self, paper_id: str, name: str, default: Any = None) -> Any:
        path = self.paper_dir(paper_id) / name
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return default

    def read_text(self, paper_id: str, name: str, default: str = "") -> str:
        path = self.paper_dir(paper_id) / name
        if not path.exists():
            return default
        try:
            return path.read_text(encoding="utf-8")
        except OSError:
            return default

    def pdf_path(self, paper_id: str) -> Optional[Path]:
        d = self.paper_dir(paper_id)
        for f in d.iterdir():
            if f.is_file() and f.suffix.lower() == ".pdf":
                return f
        return None

    def list_figures(self, paper_id: str) -> List[str]:
        fdir = self.paper_dir(paper_id) / "figures"
        if not fdir.exists():
            return []
        return sorted(p.name for p in fdir.iterdir() if p.is_file())

    # ---------- 组装（供 API 使用） ----------
    def get_metadata(self, paper_id: str) -> Dict[str, Any]:
        return self.read_json(paper_id, "metadata.json", {}) or {}

    def get_sections(self, paper_id: str) -> Dict[str, str]:
        return self.read_json(paper_id, "sections.json", {}) or {}

    def get_analysis(self, paper_id: str) -> Optional[Dict[str, Any]]:
        return self.read_json(paper_id, "analysis.json", None)

    def get_notes(self, paper_id: str) -> str:
        return self.read_text(paper_id, "notes.md", "")

    def set_notes(self, paper_id: str, notes: str) -> None:
        self.write_text(paper_id, "notes.md", notes)

    def set_notes_if_missing(self, paper_id: str) -> None:
        """首次分析时初始化 notes.md（若不存在）。"""
        path = self.paper_dir(paper_id) / "notes.md"
        if not path.exists():
            path.write_text("", encoding="utf-8")


# 单例
store = PaperStore()
