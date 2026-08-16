# ResearchOS V1 · 数据/存储 Schema

## 顶层

```
data/
├── library.json          # 论文索引（等价 SQLite 的 papers 表）
└── papers/
    └── paper_001/ …      # 每篇论文一个目录
```

## library.json（索引，数组）

```json
[
  {
    "id": "paper_001",
    "filename": "sample_satellite_iot.pdf",
    "title": "…",
    "authors": ["…"],
    "year": 2024,
    "venue": "…",
    "doi": "…",
    "keywords": ["…"],
    "sectionCount": 10,
    "analysisStatus": "none | parsed | analyzed",
    "analysisProvider": "heuristic | openai | anthropic | openai_compatible",
    "analysisModel": "…",
    "createdAt": "ISO-8601"
  }
]
```

## papers/paper_00X/ 工件

| 文件 | 类型 | 说明 |
|------|------|------|
| `paper.pdf` | 二进制 | 原始 PDF |
| `metadata.json` | JSON | 标题/作者/年份/venue/doi/摘要/关键词 |
| `sections.json` | JSON | `{规范化章节名: 文本}`（abstract/introduction/related_work/system_model/problem_formulation/method/algorithm/experiments/conclusion/references/…） |
| `extracted_text.md` | 文本 | 全文提取（含章节） |
| `analysis.json` | JSON | 16 段 + 天基字段结构化分析（见 paper-json-schema.md） |
| `notes.md` | 文本 | 用户研究笔记（模板第 16 段） |
| `figures/` | 目录 | 抽取的图片（Node 版 Phase 1 预留） |

## metadata.json

```json
{
  "title": "…",
  "authors": ["…"],
  "year": 2024,
  "venue": "…",
  "doi": "10.…",
  "abstract": "…",
  "keywords": ["…"]
}
```

## sections.json

```json
{
  "abstract": "…",
  "introduction": "…",
  "related_work": "…",
  "system_model": "…",
  "problem_formulation": "…",
  "method": "…",
  "algorithm": "…",
  "experiments": "…",
  "conclusion": "…",
  "references": "…"
}
```
键顺序即原文出现顺序（JSON 对象保持插入序）。
