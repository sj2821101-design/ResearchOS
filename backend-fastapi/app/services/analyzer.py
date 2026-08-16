"""论文分析器：把结构化后的论文交给 LLM（或本地启发式）做 16 段深度分析。"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .. import templates
from ..llm import get_provider
from ..llm.base import ProviderError
from ..store import store
from . import structure
from .common import extract_json, first_sentences, split_sentences, truncate


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


# ---------- 归一化 ----------

def _ensure_analysis(parsed: Any, include_satellite: bool) -> Dict[str, Any]:
    """把 LLM/启发式结果规整为统一的 analysis.json 结构。"""
    parsed = parsed if isinstance(parsed, dict) else {}
    sec = parsed.get("sections", {}) if isinstance(parsed.get("sections"), dict) else {}

    sections: Dict[str, Any] = {}
    for key, _title, kind in templates.GENERAL_SECTIONS:
        val = sec.get(key)
        if kind == "list":
            sections[key] = [str(x) for x in val] if isinstance(val, list) else ([str(val)] if val else [])
        else:
            sections[key] = str(val) if val else ""

    satellite: Dict[str, Any] = {}
    if include_satellite:
        sat = parsed.get("satellite", {}) if isinstance(parsed.get("satellite"), dict) else {}
        for key, _title, kind in templates.SATELLITE_FIELDS:
            val = sat.get(key)
            if kind == "list":
                satellite[key] = [str(x) for x in val] if isinstance(val, list) else ([str(val)] if val else [])
            elif kind == "object":
                satellite[key] = val if isinstance(val, dict) else {}
            else:
                satellite[key] = str(val) if val else "N/A (not covered in this paper)"

    keywords = parsed.get("keywords", [])
    if not isinstance(keywords, list):
        keywords = []

    return {
        "schema_version": "1.0",
        "overview_summary": str(parsed.get("overview_summary", "")),
        "keywords": [str(k) for k in keywords],
        "sections": sections,
        "satellite": satellite,
    }


# ---------- 本地启发式（无 LLM 时的回退） ----------

def _match_sentences(text: str, cues: List[str], limit: int = 3) -> str:
    hits = [s for s in split_sentences(text) if any(c.lower() in s.lower() for c in cues)]
    return " ".join(hits[:limit])


def _detect_terms(text: str, terms: List[str]) -> List[str]:
    low = text.lower()
    return sorted({t for t in terms if t.lower() in low})


def heuristic_analysis(meta: Dict[str, Any], sections: Dict[str, str], include_satellite: bool = True) -> Dict[str, Any]:
    intro = sections.get("introduction", "")
    concl = sections.get("conclusion", "")
    future = sections.get("future_work", "")
    full = "\n".join(sections.values())

    contributions = []
    for cue in ["contribution", "novel", "we propose", "main contributions", "this paper proposes"]:
        contributions.extend(split_sentences(_match_sentences(intro + "\n" + concl, [cue], limit=2)))
    contributions = list(dict.fromkeys(contributions))[:5] or ["(启发式) 未识别出明确贡献条目"]

    limitations = _match_sentences(concl + "\n" + future, ["limitation", "future work", "however", "remains", "can be improved", "still"], limit=4)
    limitations = split_sentences(limitations)[:4] or ["(启发式) 未识别出明确不足"]

    research_gap = limitations + (split_sentences(future)[:2] if future else [])
    research_gap = list(dict.fromkeys(research_gap))[:5]

    possible_extensions = split_sentences(future)[:4] or limitations[:2]

    parsed = {
        "overview_summary": meta.get("abstract", ""),
        "keywords": meta.get("keywords", []),
        "sections": {
            "research_problem": first_sentences(meta.get("abstract", "") or intro, 3),
            "motivation": _match_sentences(intro, ["motivat", "important", "challenge", "however", "limited", "urgent", "need", "problem"], limit=3) or "(启发式) 见 Introduction",
            "related_work": truncate(sections.get("related_work", ""), 800) or "N/A",
            "system_model": truncate(sections.get("system_model", ""), 800) or "N/A",
            "problem_formulation": truncate(sections.get("problem_formulation", "") or sections.get("mathematical_formulation", ""), 800) or "N/A",
            "proposed_method": truncate(sections.get("method", ""), 1200) or "N/A",
            "mathematical_formulation": truncate(sections.get("mathematical_formulation", "") or sections.get("method", ""), 1200) or "N/A",
            "algorithm": truncate(sections.get("algorithm", "") or sections.get("method", ""), 800) or "N/A",
            "experiment_design": truncate(sections.get("experiments", ""), 1200) or "N/A",
            "results": truncate(sections.get("experiments", ""), 1200) or "N/A",
            "contributions": contributions,
            "limitations": limitations,
            "research_gap": research_gap,
            "possible_extensions": possible_extensions,
        },
        "satellite": _heuristic_satellite(full) if include_satellite else {},
    }
    return _ensure_analysis(parsed, include_satellite)


_SATELLITE_KEYWORDS: Dict[str, List[str]] = {
    "satellite_architecture": ["satellite", "leo", "meo", "geo", "space", "orbit", "payload", "transponder"],
    "constellation_model": ["constellation", "walker", "inclination", "orbital plane", "altitude", "satellites"],
    "channel_model": ["channel", "fading", "rician", "rayleigh", "shadowing", "path loss", "free-space", "doppler", "snr"],
    "access_model": ["access", "random access", "tdma", "fdma", "cdma", "noma", "grant-free", "aloha", "slotted"],
    "resource_allocation": ["resource allocation", "bandwidth", "power allocation", "beam", "frequency", "spectrum", "scheduling"],
    "optimization_objective": ["maximize", "minimize", "objective", "optimization", "energy efficiency", "spectral efficiency", "throughput"],
    "algorithm_complexity": ["complexity", "o(", "convergence", "iteration", "computational"],
    "simulation_parameters": ["simulation", "parameters", "altitude", "bandwidth", "frequency", "transmit power"],
    "baseline_algorithms": ["tdma", "fdma", "ofdma", "noma", "random access", "round robin", "greedy", "genetic algorithm",
                            "water-filling", "dqn", "ppo", "a3c", "maddpg", "heuristic", "exhaustive search", "branch and bound"],
    "performance_metrics": ["throughput", "latency", "energy", "spectral efficiency", "coverage", "outage probability",
                            "sum rate", "delay", "fairness", "packet loss", "reliability", "qos"],
}

# baseline / metrics 需要区别于 N/A：用检测到的词条
_BASELINE_TERMS = _SATELLITE_KEYWORDS["baseline_algorithms"]
_METRIC_TERMS = _SATELLITE_KEYWORDS["performance_metrics"]


def _heuristic_satellite(full_text: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    low = full_text.lower()
    for key, terms in _SATELLITE_KEYWORDS.items():
        if key == "baseline_algorithms":
            out[key] = [t for t in _BASELINE_TERMS if t in low]
            continue
        if key == "performance_metrics":
            out[key] = [t for t in _METRIC_TERMS if t in low]
            continue
        if key == "simulation_parameters":
            out[key] = {}
            continue
        hits = [t for t in terms if t in low]
        if hits:
            out[key] = f"(启发式) 检测到相关术语: {', '.join(sorted(set(hits)))[:200]}. 配置 LLM 后可获得深度分析。"
        else:
            out[key] = "N/A (not covered in this paper)"
    return out


# ---------- 主入口 ----------

def analyze_paper(
    paper_id: str,
    provider_name: Optional[str] = None,
    model: Optional[str] = None,
    include_satellite: bool = True,
) -> Dict[str, Any]:
    meta = store.get_metadata(paper_id)
    raw_sections = store.get_sections(paper_id)

    provider = get_provider(provider_name, model)
    analysis: Optional[Dict[str, Any]] = None
    provider_used = "heuristic"
    model_used = ""

    if provider.name != "heuristic":
        # 非启发式 provider：尝试真实调用
        try:
            system = templates.build_analysis_system_prompt(include_satellite)
            user = templates.build_analysis_user_prompt(meta, raw_sections)
            resp = provider.complete(system, user)
            parsed = extract_json(resp.text)
            if parsed is not None:
                analysis = _ensure_analysis(parsed, include_satellite)
                provider_used = provider.name
                model_used = resp.model or model or ""
        except ProviderError:
            analysis = None

    if analysis is None:
        analysis = heuristic_analysis(meta, raw_sections, include_satellite)
        provider_used = "heuristic"
        model_used = ""

    analysis["paper_id"] = paper_id
    analysis["provider"] = provider_used
    analysis["model"] = model_used
    analysis["generated_at"] = _now()
    analysis["title"] = meta.get("title", "")
    analysis["authors"] = meta.get("authors", [])
    analysis["year"] = meta.get("year")
    analysis["venue"] = meta.get("venue", "")

    store.write_json(paper_id, "analysis.json", analysis)
    store.set_notes_if_missing(paper_id)  # 确保 notes.md 存在
    from .. import db
    db.set_analysis_status(paper_id, "analyzed", provider_used, model_used or None)
    return analysis


def has_analysis(paper_id: str) -> bool:
    return store.get_analysis(paper_id) is not None
