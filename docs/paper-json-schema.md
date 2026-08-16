# ResearchOS V1 · analysis.json Schema

```json
{
  "schema_version": "1.0",
  "paper_id": "paper_001",
  "provider": "heuristic",
  "model": "",
  "generated_at": "ISO-8601",
  "title": "…",
  "authors": ["…"],
  "year": 2024,
  "venue": "…",
  "overview_summary": "2-3 句全文概述",
  "keywords": ["…"],
  "sections": {
    "research_problem": "…",
    "motivation": "…",
    "related_work": "…",
    "system_model": "…",
    "problem_formulation": "…",
    "proposed_method": "…",
    "mathematical_formulation": "…",
    "algorithm": "…",
    "experiment_design": "…",
    "results": "…",
    "contributions": ["…"],
    "limitations": ["…"],
    "research_gap": ["…"],
    "possible_extensions": ["…"]
  },
  "satellite": {
    "satellite_architecture": "…",
    "constellation_model": "…",
    "channel_model": "…",
    "access_model": "…",
    "resource_allocation": "…",
    "optimization_objective": "…",
    "algorithm_complexity": "…",
    "simulation_parameters": { "orbit_altitude": "550 km", "bandwidth": "10 MHz" },
    "baseline_algorithms": ["OFDMA", "TDMA", "…"],
    "performance_metrics": ["throughput", "latency", "…"]
  }
}
```

## 字段类型约定

- `sections` 中 **text 型**：字符串，1-4 句；**list 型**（contributions/limitations/research_gap/possible_extensions）：字符串数组 2-6 项。
- `satellite` 中 **text 型**：论文未涉及则填 `"N/A (not covered in this paper)"`；**list 型**未涉及填 `[]`；**object 型**（simulation_parameters）为参数名→值的对象。
- 第 01 段 Paper Overview 由 `overview_summary` + `metadata.abstract` 呈现；第 16 段 My Research Notes 存于 `notes.md`，不在本文件中。

## 与"简化版 analysis.json"的对应

会话里提到的简化结构也完全覆盖：
`research_problem`(sections) · `motivation`(sections) · `method`(sections.proposed_method) ·
`innovation`(sections.contributions) · `limitations`(sections.limitations) ·
`experiments`(sections.experiment_design + results) · `research_gaps`(sections.research_gap) · `keywords`。
