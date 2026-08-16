# ResearchOS V1 · 技术架构

## 分层视图

```
┌──────────────────────────────────────────────────────────────┐
│  表现层  frontend/                                            │
│  index.html + styles.css + app.js（原生 SPA，零构建）          │
│  · 拖拽上传   · 论文列表/搜索/多选   · 四页签(详情/对比/Gap/问答) │
└──────────────────────────────┬───────────────────────────────┘
                               │ fetch('/api/*')
┌──────────────────────────────▼───────────────────────────────┐
│  接口层  server/server.js（Node http，零依赖，手写路由）         │
│  /api/health · /api/papers(CRUD) · /api/compare · /api/gaps · /api/qa
└──────┬──────────────┬──────────────┬──────────────┬──────────┘
       │              │              │              │
  lib/pdf.js     lib/structure.js  lib/analyzer.js  lib/comparer.js
  PDF文本抽取     章节识别+元数据     分析编排          lib/gap.js
  (zlib+FlateDecode)               (LLM→启发式)       lib/qa.js
                                   └──── lib/templates.js（16段+天基模板）
                                          lib/llm.js（LLM 抽象层）
┌──────────────────────────────┬───────────────────────────────┐
│  持久层  lib/store.js                                          │
│  data/papers/paper_00X/…（工件文件） + data/library.json（索引）  │
└──────────────────────────────────────────────────────────────┘
```

## 关键设计决策

1. **LLM 抽象层**（`lib/llm.js`）：上层只调用 `getProvider(name, model).complete(system, user)`，
   底层实现 OpenAI / Anthropic / OpenAI 兼容 / heuristic 四种。换模型只改 `.env`，不改业务代码。
2. **启发式回退**：任何 provider 调用失败或未配置 Key，自动落到 `analyzer.heuristicAnalysis()`，
   保证离线可用、链路永远能跑通。
3. **零依赖**：仅用 Node 内置 `http` / `zlib` / `fs` / `path` / `url` / `fetch`。
   牺牲了框架便利，换取"任何装了 Node 的机器都能直接跑"。
4. **索引与工件分离**：`library.json` 只存检索/列表所需字段；PDF、全文、分析结果以文件落盘，
   人可直接阅读、可随目录迁移。

## 数据流（导入一篇论文）

```
POST /api/papers (raw PDF bytes + X-Filename)
  → store.nextId() 分配 paper_00X
  → pdf.extractPdf()  FlateDecode 解压 → Tj/TJ 运算符 → 纯文本
  → structure.extractMetadata()  / structure.detectSections()
  → 落盘 metadata.json / sections.json / extracted_text.md / notes.md / paper.pdf
  → store.upsertPaper() 写入 library.json 索引
  → 返回 { id, metadata, num_pages, num_sections, ... }
```

## 数据流（分析一篇论文）

```
POST /api/papers/{id}/analyze
  → analyzer.analyzePaper()
  → getProvider() → 若可用：templates 构造 prompt → provider.complete() → extractJson()
  → 解析失败/不可用：heuristicAnalysis()
  → 归一化 ensureAnalysis() → 写 analysis.json → 更新 library.json 状态 → 返回
```

## 扩展点

- 换解析引擎：在 `pdf.js` 后追加 GROBID/Docling 输出，替换 `structure` 的规则结果。
- 换数据库：`store.js` 的接口不变，内部可换成 SQLite/PostgreSQL。
- 加向量检索：在 `qa.js` 的 `retrieve()` 换成向量相似度。
- 加实验 Agent（Phase 4）：新增 `lib/experiment.js`，复用 `llm.js` 与 `store.js`。
