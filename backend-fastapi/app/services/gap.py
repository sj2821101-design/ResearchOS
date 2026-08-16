"""Research Gap 发现：跨多篇论文汇总研究空白。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..llm import get_provider
from ..llm.base import ProviderError
from ..store import store
from .common import extract_json, truncate


def find_gaps(paper_ids: List[str], provider_name: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    items: List[Dict[str, Any]] = []
    for pid in paper_ids:
        meta = store.get_metadata(pid)
        analysis = store.get_analysis(pid) or {}
        sec = analysis.get("sections", {}) or {}
        items.append({
            "paper_id": pid,
            "title": meta.get("title") or analysis.get("title") or pid,
            "limitations": sec.get("limitations", []),
            "research_gap": sec.get("research_gap", []),
            "possible_extensions": sec.get("possible_extensions", []),
        })

    provider = get_provider(provider_name, model)
    result: Dict[str, Any] = {
        "provider": provider.name,
        "papers": items,
        "research_gaps": [],
        "summary": "",
    }

    if provider.name != "heuristic":
        user_lines = ["Synthesize research gaps across these papers. Return ONLY valid JSON (no fences):",
                      '{ "research_gaps": ["gap1", "gap2", ...], "summary": "..." }',
                      "", "=== PAPERS ==="]
        for it in items:
            user_lines.append(f"\n[{it['paper_id']}] {it['title']}")
            user_lines.append(f"  limitations: {'; '.join(it['limitations'])[:400]}")
            user_lines.append(f"  research_gap: {'; '.join(it['research_gap'])[:400]}")
            user_lines.append(f"  possible_extensions: {'; '.join(it['possible_extensions'])[:400]}")
        try:
            resp = provider.complete(
                system="You are a research strategist who identifies research gaps.",
                user="\n".join(user_lines),
            )
            parsed = extract_json(resp.text)
            if isinstance(parsed, dict):
                result["research_gaps"] = parsed.get("research_gaps", [])
                result["summary"] = parsed.get("summary", "")
                result["provider"] = provider.name
                result["model"] = resp.model or model or ""
                return result
        except ProviderError:
            pass

    # heuristic 回退：去重合并
    result["provider"] = "heuristic"
    gaps: List[str] = []
    for it in items:
        gaps.extend(it["research_gap"])
        gaps.extend(it["limitations"])
        gaps.extend(it["possible_extensions"])
    seen: set = set()
    result["research_gaps"] = [g for g in gaps if g and not (g in seen or seen.add(g))][:12]
    result["summary"] = (
        f"启发式汇总：从 {len(items)} 篇论文的 limitations / research_gap / possible_extensions 中"
        f"去重得到 {len(result['research_gaps'])} 条潜在研究空白。配置 LLM 后可获得语义层面的聚类与凝练。"
    )
    return result
