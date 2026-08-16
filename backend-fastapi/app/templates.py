"""论文分析模板与 Prompt 构造。

模板共 16 段（与会话约定一致）：
    01 Paper Overview       —— 元数据/概述（由解析器给出，不进 LLM）
    02 Research Problem     —— 研究问题
    03 Motivation           —— 动机/为什么重要
    04 Related Work         —— 相关工作
    05 System Model         —— 系统模型
    06 Problem Formulation  —— 问题建模
    07 Proposed Method      —— 提出方法
    08 Mathematical Formulation —— 数学建模
    09 Algorithm            —— 算法
    10 Experiment Design    —— 实验设计
    11 Results              —— 实验结果
    12 Contributions        —— 贡献/创新点
    13 Limitations          —— 不足
    14 Research Gap         —— 研究空白
    15 Possible Extensions  —— 可扩展方向
    16 My Research Notes    —— 用户自己的笔记（存 notes.md，不由 LLM 生成）

额外天基物联网字段（10 个），用于把工具从"通用论文阅读器"逐步打造成
"天基物联网科研分析器"。
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

# (key, 标题, 类型) —— type: "text" | "list"
GENERAL_SECTIONS: List[Tuple[str, str, str]] = [
    ("research_problem", "02 Research Problem", "text"),
    ("motivation", "03 Motivation", "text"),
    ("related_work", "04 Related Work", "text"),
    ("system_model", "05 System Model", "text"),
    ("problem_formulation", "06 Problem Formulation", "text"),
    ("proposed_method", "07 Proposed Method", "text"),
    ("mathematical_formulation", "08 Mathematical Formulation", "text"),
    ("algorithm", "09 Algorithm", "text"),
    ("experiment_design", "10 Experiment Design", "text"),
    ("results", "11 Results", "text"),
    ("contributions", "12 Contributions", "list"),
    ("limitations", "13 Limitations", "list"),
    ("research_gap", "14 Research Gap", "list"),
    ("possible_extensions", "15 Possible Extensions", "list"),
]

SATELLITE_FIELDS: List[Tuple[str, str, str]] = [
    ("satellite_architecture", "Satellite Architecture", "text"),
    ("constellation_model", "Constellation Model", "text"),
    ("channel_model", "Channel Model", "text"),
    ("access_model", "Access Model", "text"),
    ("resource_allocation", "Resource Allocation", "text"),
    ("optimization_objective", "Optimization Objective", "text"),
    ("algorithm_complexity", "Algorithm Complexity", "text"),
    ("simulation_parameters", "Simulation Parameters", "object"),
    ("baseline_algorithms", "Baseline Algorithms", "list"),
    ("performance_metrics", "Performance Metrics", "list"),
]

SECTION_TITLES = {key: title for key, title, _ in GENERAL_SECTIONS}
SATELLITE_TITLES = {key: title for key, title, _ in SATELLITE_FIELDS}
LIST_FIELDS = {key for key, _, t in GENERAL_SECTIONS if t == "list"} | {
    key for key, _, t in SATELLITE_FIELDS if t == "list"
}


def _budget(text: str, n: int) -> str:
    text = (text or "").strip()
    if len(text) <= n:
        return text
    return text[:n] + "\n...[truncated]"


def build_analysis_system_prompt(include_satellite: bool = True) -> str:
    satellite_block = ""
    if include_satellite:
        sat_lines = "\n".join(
            f'    "{key}": ' + ('"..."' if t == "text" else ('["..."]' if t == "list" else '{...}'))
            + ","
            for key, _title, t in SATELLITE_FIELDS
        )
        satellite_block = f"""
  "satellite": {{
{sat_lines}
  }},
"""

    prompt = f"""You are a senior research analyst specializing in satellite IoT / space-terrestrial integrated networks.
Read the provided academic paper (title, abstract, keywords, and sections) and produce a STRUCTURED JSON analysis.

Return ONLY a valid JSON object — no markdown fences, no commentary, no extra text — matching this exact schema:
{{
  "keywords": ["...", "..."],
  "sections": {{
    "research_problem": "...",
    "motivation": "...",
    "related_work": "...",
    "system_model": "...",
    "problem_formulation": "...",
    "proposed_method": "...",
    "mathematical_formulation": "...",
    "algorithm": "...",
    "experiment_design": "...",
    "results": "...",
    "contributions": ["...", "..."],
    "limitations": ["...", "..."],
    "research_gap": ["...", "..."],
    "possible_extensions": ["...", "..."]
  }},{satellite_block}
  "overview_summary": "..."
}}

Rules:
- Write all content in the same language as the paper's abstract (usually English).
- Text fields: 1-4 informative sentences each, grounded in the paper. Do NOT invent content that is absent.
- List fields (contributions / limitations / research_gap / possible_extensions / baseline_algorithms / performance_metrics): 2-6 short, specific items.
- If the paper does not cover a satellite-specific field, set it to "N/A (not covered in this paper)" for text fields, or [] for list fields.
- simulation_parameters is an object of parameter-name -> value (e.g. {{"orbit_altitude": "550 km", "bandwidth": "10 MHz"}}).
- overview_summary: a 2-3 sentence abstract-level summary of the whole paper.
- If a section is genuinely absent from the paper, write a one-line honest note ("Not explicitly discussed") rather than fabricating."""
    return prompt


def build_analysis_user_prompt(meta: Dict[str, Any], sections: Dict[str, str], char_budget: int = 24000) -> str:
    lines: List[str] = []
    lines.append("=== PAPER METADATA ===")
    lines.append(f"Title: {meta.get('title', 'N/A')}")
    lines.append(f"Authors: {', '.join(meta.get('authors', [])) or 'N/A'}")
    lines.append(f"Year: {meta.get('year', 'N/A')}   Venue: {meta.get('venue', 'N/A')}")
    lines.append(f"Keywords: {', '.join(meta.get('keywords', [])) or 'N/A'}")
    lines.append("")
    lines.append(f"Abstract:\n{_budget(meta.get('abstract', ''), 2500)}")
    lines.append("")
    lines.append("=== PAPER SECTIONS (truncated) ===")
    used = 0
    for key, title in SECTION_TITLES.items():
        text = sections.get(key, "")
        if not text:
            continue
        room = char_budget - used
        if room <= 0:
            break
        chunk = _budget(text, min(room, 4000))
        lines.append(f"\n## {title}\n{chunk}")
        used += len(chunk)
    # 天基物联网相关线索可能散落在任意章节，附上原文中出现的术语提示
    lines.append("")
    lines.append("=== NOTE ===")
    lines.append(
        "Pay special attention to any satellite/constellation/channel/access/resource-allocation content "
        "for the satellite-specific fields."
    )
    return "\n".join(lines)
