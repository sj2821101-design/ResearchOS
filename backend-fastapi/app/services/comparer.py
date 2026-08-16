"""多篇论文对比：技术路线演化、优缺点、Research Gap。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..llm import get_provider
from ..llm.base import ProviderError
from ..store import store
from .common import extract_json, truncate


def _paper_summary(paper_id: str) -> Dict[str, Any]:
    meta = store.get_metadata(paper_id)
    analysis = store.get_analysis(paper_id) or {}
    sec = analysis.get("sections", {}) or {}
    return {
        "paper_id": paper_id,
        "title": meta.get("title") or analysis.get("title") or paper_id,
        "year": meta.get("year") or analysis.get("year"),
        "research_problem": sec.get("research_problem", ""),
        "proposed_method": sec.get("proposed_method", ""),
        "results": sec.get("results", ""),
        "contributions": sec.get("contributions", []),
        "limitations": sec.get("limitations", []),
        "research_gap": sec.get("research_gap", []),
    }


def _build_comparison_prompt(summaries: List[Dict[str, Any]]) -> str:
    lines = ["Compare the following papers and return ONLY valid JSON (no fences) matching this schema:",
             '{ "method_evolution": "...", '
             '"strengths_weaknesses": {"<paper_id>": {"strengths": ["..."], "weaknesses": ["..."]}}, '
             '"research_gap": ["..."] }',
             "",
             "Requirements:",
             "- method_evolution: 2-5 sentences tracing how the technical route evolved across these papers.",
             "- strengths_weaknesses: per paper_id, 2-4 strengths and 2-4 weaknesses.",
             "- research_gap: 3-6 concrete open problems synthesized from the papers.",
             "",
             "=== PAPERS ==="]
    for s in summaries:
        lines.append(f"\n[{s['paper_id']}] {s['title']} ({s['year']})")
        lines.append(f"  research_problem: {truncate(s['research_problem'], 500)}")
        lines.append(f"  proposed_method: {truncate(s['proposed_method'], 500)}")
        lines.append(f"  limitations: {'; '.join(s['limitations'])[:400]}")
        lines.append(f"  research_gap: {'; '.join(s['research_gap'])[:400]}")
    return "\n".join(lines)


def compare_papers(paper_ids: List[str], provider_name: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    summaries = [_paper_summary(pid) for pid in paper_ids]
    provider = get_provider(provider_name, model)

    result: Dict[str, Any] = {
        "provider": provider.name,
        "papers": summaries,
        "method_evolution": "",
        "strengths_weaknesses": {},
        "research_gap": [],
    }

    if provider.name != "heuristic":
        try:
            resp = provider.complete(
                system="You are a senior research analyst comparing academic papers.",
                user=_build_comparison_prompt(summaries),
            )
            parsed = extract_json(resp.text)
            if isinstance(parsed, dict):
                result["method_evolution"] = parsed.get("method_evolution", "")
                result["strengths_weaknesses"] = parsed.get("strengths_weaknesses", {})
                result["research_gap"] = parsed.get("research_gap", [])
                result["provider"] = provider.name
                result["model"] = resp.model or model or ""
                return result
        except ProviderError:
            pass

    # heuristic 回退
    result["provider"] = "heuristic"
    result["method_evolution"] = " → ".join(
        f"{s['title']}（{s['year']}）提出 {truncate(s['proposed_method'], 120) or 'N/A'}" for s in summaries
    )
    result["strengths_weaknesses"] = {
        s["paper_id"]: {
            "strengths": s["contributions"] or ["未识别"],
            "weaknesses": s["limitations"] or ["未识别"],
        }
        for s in summaries
    }
    gaps: List[str] = []
    for s in summaries:
        gaps.extend(s["research_gap"])
        gaps.extend(s["limitations"])
    seen: set = set()
    result["research_gap"] = [g for g in gaps if g and not (g in seen or seen.add(g))][:8]
    return result
