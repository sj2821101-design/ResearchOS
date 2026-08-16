"""论文问答：基于论文库的简单检索 + LLM 生成（无 LLM 时返回相关原文句）。"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from ..llm import get_provider
from ..llm.base import ProviderError
from ..store import store
from .common import split_sentences, truncate

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "of", "in", "on", "to", "for",
    "with", "and", "or", "by", "as", "at", "from", "this", "that", "these", "those", "what",
    "which", "how", "why", "does", "do", "did", "whats", "its", "it", "we", "they", "you",
    "论文", "的", "了", "是", "和", "与", "及", "在", "中", "对", "该", "如何", "什么", "哪些",
}


def _tokens(text: str) -> List[str]:
    return [t for t in re.findall(r"[A-Za-z0-9\u4e00-\u9fff]+", text.lower()) if t not in _STOPWORDS]


def _retrieve(paper_ids: List[str], question: str, top_k: int = 6) -> List[Dict[str, str]]:
    q_tokens = set(_tokens(question))
    scored: List[tuple] = []
    for pid in paper_ids:
        meta = store.get_metadata(pid)
        sections = store.get_sections(pid)
        for section_name, text in sections.items():
            for sent in split_sentences(text):
                sent_tokens = set(_tokens(sent))
                if not sent_tokens:
                    continue
                overlap = len(q_tokens & sent_tokens) + 0.5 * len(q_tokens & set(_tokens(section_name)))
                if overlap > 0:
                    scored.append((overlap, pid, meta.get("title", pid), section_name, sent))
    scored.sort(key=lambda x: -x[0])
    top = scored[:top_k]
    return [
        {"paper_id": p, "title": t, "section": s, "text": truncate(sent, 800)}
        for _score, p, t, s, sent in top
    ]


def answer_question(
    paper_ids: List[str],
    question: str,
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    hits = _retrieve(paper_ids, question)
    provider = get_provider(provider_name, model)

    result: Dict[str, Any] = {
        "provider": provider.name,
        "question": question,
        "answer": "",
        "sources": hits,
    }

    if provider.name != "heuristic" and hits:
        ctx = "\n\n".join(
            f"[{h['paper_id']} | {h['title']} | {h['section']}]\n{h['text']}" for h in hits
        )
        system = (
            "You are a research assistant. Answer the user's question using ONLY the provided paper excerpts. "
            "Be precise and cite the paper titles/ids in your answer. If the excerpts are insufficient, say so."
        )
        user = f"QUESTION: {question}\n\nEXCERPTS:\n{ctx}"
        try:
            resp = provider.complete(system, user)
            result["answer"] = resp.text
            result["provider"] = provider.name
            result["model"] = resp.model or model or ""
            return result
        except ProviderError:
            pass

    # heuristic 回退：直接返回最相关的原文句
    result["provider"] = "heuristic"
    if hits:
        result["answer"] = "\n\n".join(
            f"【{h['paper_id']} · {h['section']}】 {h['text']}" for h in hits
        )
    else:
        result["answer"] = "在所选论文中未检索到与问题相关的段落。请尝试更具体的关键词，或换一批论文。"
    return result
