"""论文结构化：章节识别 + 元数据提取（纯规则启发式）。

输出两类结果：
1. metadata：title / authors / year / venue / doi / abstract / keywords
2. sections：{规范化章节名: 文本}（插入序 = 原文出现顺序）

Phase 1 用规则近似；后续可替换为 GROBID / Docling 得到更高精度的结构化结果。
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# 规范化章节名 -> 命中别名（小写）。顺序即匹配优先级。
SECTION_ALIASES: List[Tuple[str, List[str]]] = [
    ("abstract", ["abstract", "summary"]),
    ("keywords", ["keywords", "index terms", "key words", "keyword"]),
    ("introduction", ["introduction", "intro"]),
    ("related_work", ["related work", "related works", "related studies", "background",
                      "literature review", "prior work", "previous work", "state of the art",
                      "related literature"]),
    ("system_model", ["system model", "system architecture", "network model", "system overview",
                      "system and channel model", "architecture overview", "network architecture",
                      "system scenario", "scenario description"]),
    ("problem_formulation", ["problem formulation", "problem statement", "problem definition",
                             "problem setup", "problem description"]),
    ("method", ["proposed method", "proposed approach", "proposed scheme", "proposed algorithm",
                "method", "methodology", "approach", "our method", "our approach", "the proposed method",
                "proposed solution", "proposed framework", "methods", "scheme design"]),
    ("mathematical_formulation", ["mathematical formulation", "mathematical model", "mathematical analysis",
                                  "formulation", "problem modeling", "modeling", "mathematical framework"]),
    ("algorithm", ["algorithm", "the algorithm", "algorithms", "proposed algorithm", "algorithm design",
                   "algorithm description"]),
    ("experiments", ["experiment", "experiments", "experimental", "experimental results", "evaluation",
                     "performance evaluation", "simulation", "simulations", "simulation results",
                     "numerical results", "results", "results and discussion", "results and analysis",
                     "performance analysis", "case study", "case studies", "experimental setup",
                     "simulation setup", "experimental design"]),
    ("conclusion", ["conclusion", "conclusions", "conclusion and future work", "concluding remarks",
                    "summary and conclusion"]),
    ("discussion", ["discussion", "discussions"]),
    ("future_work", ["future work", "future works", "future directions", "future research"]),
    ("references", ["references", "bibliography", "bibliographic"]),
]

_TITLE_PATTERNS = [
    re.compile(r"^(\d{1,2}(?:\.\d+){0,3})\.?\s+(.+)$"),
    re.compile(r"^([A-I]|[IVX]{1,4})\.\s+(.+)$"),
]

_SKIP_HEADING_WORDS = {"and", "or", "the", "a", "an", "of", "for", "with", "in", "on", "to", "is", "are"}


def _clean_heading(line: str) -> str:
    """去掉编号/标点，得到可用于匹配的纯标题小写。"""
    s = line.strip()
    s = re.sub(r"^\d{1,2}(?:\.\d+){0,3}\.?[\s.]*", "", s)
    s = re.sub(r"^([A-I]|[IVX]{1,4})\.\s+", "", s)
    s = re.sub(r"[:\-–—]*\s*$", "", s)
    return s.strip().lower()


def _classify_heading(line: str) -> Optional[str]:
    cleaned = _clean_heading(line)
    if not cleaned:
        return None
    # 精确/前缀匹配别名
    for canonical, aliases in SECTION_ALIASES:
        for alias in aliases:
            if cleaned == alias or cleaned.startswith(alias + " ") or cleaned.startswith(alias + ":"):
                return canonical
    # 匹配形如 "1. Introduction" 的编号标题：清理后仍有内容且是已知词
    return None


def _is_probable_heading(line: str, next_line: str) -> bool:
    """判断一行是否像标题（用于那些不在别名表里的二级标题，酌情保留）。"""
    s = line.strip()
    if not s or len(s) > 90:
        return False
    if s[-1] in ".!?,":
        return False
    if _classify_heading(s) is not None:
        return True
    # 编号 + 短标题
    for pat in _TITLE_PATTERNS:
        m = pat.match(s)
        if m and len(m.group(2)) <= 70:
            return True
    return False


def detect_sections(text: str) -> Dict[str, str]:
    """按标题把全文切成 {规范化章节名: 文本}，插入序保持原文顺序。"""
    lines = text.splitlines()
    result: Dict[str, str] = {}
    current: Optional[str] = None
    buf: List[str] = []

    def flush() -> None:
        nonlocal buf
        if current is not None:
            body = "\n".join(buf).strip()
            if body:
                result[current] = (result.get(current, "") + "\n\n" + body).strip() if current in result else body
        buf = []

    for i, raw in enumerate(lines):
        line = raw.rstrip()
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        canonical = _classify_heading(line) if _is_probable_heading(line, nxt) else None
        if canonical is not None:
            flush()
            current = canonical
            # 标题行本身之后的内容从下一行开始
            continue
        buf.append(line)

    flush()

    # 参考文献前的正文往往被切成 references 之外；无标题段落归入 "unlabeled" 是合理的，
    # 但若完全没有 references 段落也没关系。
    return result


def _first_nonempty(lines: List[str]) -> Optional[str]:
    for l in lines:
        if l.strip():
            return l.strip()
    return None


def _looks_like_affiliation(line: str) -> bool:
    low = line.lower()
    markers = ["@", "university", "univ.", "institute", "department", "school", "laboratory",
               "lab.", "college", "china", "beijing", "shanghai", "corp", "ltd", "inc", "academy",
               "center", "centre", "email", "corresponding"]
    return any(m in low for m in markers)


def extract_metadata(text: str, pdf_meta: Dict[str, Any]) -> Dict[str, Any]:
    lines = text.splitlines()
    nonempty = [l for l in lines if l.strip()]
    abstract_idx = next((i for i, l in enumerate(nonempty) if _classify_heading(l) == "abstract"), None)

    # --- title ---
    meta_title = (pdf_meta.get("title") or "").strip()
    title = meta_title if len(meta_title) > 3 and meta_title.lower() not in {"untitled", "none"} else ""
    if not title:
        head = nonempty[: (abstract_idx if abstract_idx is not None else min(5, len(nonempty)))]
        # 取第一段非数字、非作者样式的连续 1-2 行
        cand: List[str] = []
        for l in head:
            s = l.strip()
            if not s or len(s) > 220 or _looks_like_affiliation(s):
                break
            cand.append(s)
            if len(" ".join(cand)) > 15:
                break
        title = " ".join(cand).strip(" .:-") if cand else ""

    # --- authors ---
    meta_authors = (pdf_meta.get("author") or "").strip()
    authors: List[str] = []
    if meta_authors:
        authors = [a.strip() for a in re.split(r"[;,]", meta_authors) if a.strip()]
    if not authors and abstract_idx is not None:
        for l in nonempty[:abstract_idx]:
            s = l.strip()
            if _looks_like_affiliation(s):
                continue
            if s == title or (title and s in title):
                continue
            # 姓名行通常较短、不含句末标点、不含常见论文词
            if len(s) < 120 and not s.endswith((".", ":", "?")):
                parts = re.split(r"[,;]|\band\b", s)
                names = [p.strip() for p in parts if p.strip() and len(p.strip()) <= 60]
                if 1 <= len(names) <= 12:
                    authors = names
                    break

    # --- year / venue / doi ---
    year: Optional[int] = None
    for src in (pdf_meta.get("creationDate", ""), pdf_meta.get("modDate", ""), text[:4000]):
        m = re.search(r"\b(19|20)(\d{2})\b", src)
        if m:
            year = int(m.group(0))
            break
    venue = ""
    venue_m = re.search(r"(Proceedings of [A-Za-z0-9 ,'&-]+|Journal of [A-Za-z0-9 ,'&-]+|IEEE Transactions on [A-Za-z0-9 ,'&-]+|arXiv)", text[:6000])
    if venue_m:
        venue = venue_m.group(0).strip()
    doi = ""
    doi_m = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", text[:8000])
    if doi_m:
        doi = doi_m.group(0).strip(".,;")

    # --- abstract ---
    abstract = ""
    sections = detect_sections(text)
    abstract = sections.get("abstract", "").strip()

    # --- keywords ---
    keywords: List[str] = []
    kw_section = sections.get("keywords", "")
    if kw_section:
        # 关键词段落：去掉 "keywords/index terms" 前缀后按逗号/分号切分
        kw_section = re.sub(r"(?i)^(keywords?|index terms|key words)\s*[:：]?\s*", "", kw_section)
        first_line = kw_section.split("\n")[0]
        keywords = [k.strip() for k in re.split(r"[;,，；]", first_line) if k.strip()][:20]
    if not keywords:
        m = re.search(r"(?i)^\s*(keywords?|index terms|key words)\s*[:：]\s*(.+)$", text, re.MULTILINE)
        if m:
            keywords = [k.strip() for k in re.split(r"[;,，；]", m.group(2)) if k.strip()][:20]

    return {
        "title": title.strip(),
        "authors": authors,
        "year": year,
        "venue": venue,
        "doi": doi,
        "abstract": abstract,
        "keywords": keywords,
    }
