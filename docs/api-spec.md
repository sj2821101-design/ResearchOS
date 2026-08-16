# ResearchOS V1 · REST API

Base URL: `http://127.0.0.1:8000`，全部 JSON（UTF-8），上传用 raw body。

## 通用

- 错误响应：`{ "detail": "错误信息" }`（对应 4xx/5xx）。
- CORS 全开。

## 端点

### `GET /api/health`
```json
{ "status": "ok", "version": "1.0.0", "papers": 2 }
```

### `POST /api/papers` — 上传
- 请求体：**原始 PDF 字节**（非 multipart）
- 请求头：`X-Filename: 文件名.pdf`（URL 编码）、`Content-Type: application/pdf`
- 响应 `201`：
```json
{ "id": "paper_001", "filename": "x.pdf", "metadata": {…},
  "num_pages": 1, "num_sections": 10, "num_figures": 0, "source": "pdf", "title": "…" }
```

### `GET /api/papers` — 列表
返回 `library.json` 中的论文数组（按创建时间倒序）。

### `GET /api/papers/{id}` — 详情
```json
{ "id": "paper_001", "metadata": {…}, "sections": {…},
  "analysis": {…} | null, "notes": "…", "has_pdf": true, "figures": [] }
```

### `POST /api/papers/{id}/analyze` — 分析
请求体：`{ "provider": "…?", "model": "…?", "include_satellite": true }`（均可省略）
响应：完整 `analysis.json`。

### `GET /api/papers/{id}/notes` / `PUT /api/papers/{id}/notes`
```json
{ "notes": "…" }
```

### `GET /api/papers/{id}/figures/{name}` — 图片（二进制）

### `POST /api/compare`
```json
{ "paper_ids": ["paper_001","paper_002"], "provider": "…?" }
```
响应：
```json
{ "provider": "heuristic", "papers": [ { "paper_id","title","year","research_problem","proposed_method","results","contributions","limitations","research_gap" } ],
  "method_evolution": "…", "strengths_weaknesses": { "paper_001": { "strengths":[], "weaknesses":[] } }, "research_gap": [] }
```

### `POST /api/gaps`
```json
{ "paper_ids": ["…"], "provider": "…?" }
```
响应：`{ "provider","papers":[{…limitations/research_gap/possible_extensions}], "research_gaps":[], "summary":"…" }`

### `POST /api/qa`
```json
{ "paper_ids": ["…"], "question": "…", "provider": "…?" }
```
响应：`{ "provider", "question", "answer", "sources":[{ "paper_id","title","section","text" }] }`
（`paper_ids` 为空表示对全部论文提问）
