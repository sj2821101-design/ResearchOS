# ResearchOS · 论文分析工作台

> 🌐 **English**: [README_EN.md](README_EN.md) · 简体中文

> 面向科研人员的本地 AI 论文分析平台：把 PDF 变成结构化科研知识，并提供**带原文证据的深度分析**与**论文问答**。
>
> **🤝 开放共建中**：这是一个"大家一起把它越做越好"的开源项目——提需求、报 Bug、贡献代码、分享论文样本，统统欢迎。详见文末 [参与共建](#-欢迎参与共建)。

```
PDF 导入 → 解析(中英文) → 章节/元数据 → 16 段模板 + 天基物联网字段分析
        → 原文证据(Evidence) → 落盘 → 网页展示 → 对比 → Research Gap → 问答
```

## ✨ 特性

- **中文/复杂字体 PDF 支持**：基于 PyMuPDF，正确处理中文 CID / ToUnicode / 复杂字体（不再是"英文专用"）。
- **带证据的分析**：每条 AI 结论都绑定论文**原文 quote**，并本地校验（quote 必须能在原文中找到才标记 `verified`）。
- **16 段论文拆解** + **10 个天基物联网字段**（面向卫星通信/天基物联网方向）。
- **证据分级**：`paper_stated`（作者明确表述）/ `derived`（合理推导）/ `speculative`（推测）。
- **论文问答**：支持中文提问英文论文（跨语言），自动回退全文上下文。
- **零 npm 依赖后端**：Node.js 内置 `http` + `zlib` + `fetch`，`npm install` 都不需要。
- **无 Key 也能跑**：内置本地启发式分析回退；配置 DeepSeek/OpenAI/Claude 后自动切换深度分析。
- **全中文界面**，AI 分析结果默认输出简体中文。

## 🚀 快速开始

**前置**：Node.js ≥ 18（零 npm 依赖）。Python 可选（仅中文/复杂 PDF 需要）。

```bash
# 克隆并启动
git clone https://github.com/sj2821101-design/ResearchOS.git
cd ResearchOS
node server/server.js          # Windows 也可双击 start.bat
```

打开 **http://127.0.0.1:8000**，拖入 PDF 即可。

> 仓库自带样例 `sample/sample_satellite_iot.pdf`（天基物联网主题）可立即体验。

### 启用中文 PDF 最佳解析（可选，推荐）

系统 Python 需已安装 PyMuPDF：

```bash
pip install pymupdf
```

如果你的 PyMuPDF 装在非系统 Python，可指定：

```bash
# Windows PowerShell
$env:RESEARCHOS_PYTHON="E:\你的Python\python.exe"
node server/server.js
```

> 未配置 PyMuPDF 时，自动回退到内置的 Node 解析器（英文 PDF 正常，中文/复杂字体会乱码）。

### 配置 LLM（可选）

复制 `.env.example` 为 `.env`，填一种即可：

```bash
# DeepSeek（OpenAI 兼容端点）
LLM_PROVIDER=openai_compatible
LLM_MODEL=deepseek-chat
OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com/v1
OPENAI_COMPATIBLE_API_KEY=sk-xxxx

# 或 OpenAI / Claude / Ollama / vLLM
# LLM_PROVIDER=openai              OPENAI_API_KEY=...
# LLM_PROVIDER=anthropic           ANTHROPIC_API_KEY=...
# LLM_PROVIDER=openai_compatible   OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434/v1  (Ollama)
```

不填 Key 则使用本地启发式分析。

## 🧩 16 段分析模板

| # | 字段 | # | 字段 |
|---|------|---|------|
| 01 | 论文概览 | 09 | 算法 |
| 02 | 研究问题 | 10 | 实验设计 |
| 03 | 研究动机 | 11 | 实验结果 |
| 04 | 相关工作 | 12 | 贡献与创新 |
| 05 | 系统模型 | 13 | 局限性 |
| 06 | 问题建模 | 14 | 研究空白 |
| 07 | 提出方法 | 15 | 可扩展方向 |
| 08 | 数学建模 | 16 | 我的研究笔记 |

**天基物联网字段**：卫星架构 · 星座模型 · 信道模型 · 接入模型 · 资源分配 · 优化目标 · 算法复杂度 · 仿真参数 · 基线算法 · 性能指标

## 🏗 技术架构

```
前端：原生 HTML/CSS/JS（静态 SPA，零构建）
        │ HTTP /api/*
后端：Node.js 内置 http（零依赖）
        ├─ pdf_worker.js ──spawn──▶ scripts/pdf_extract.py (PyMuPDF)  ← 主解析，中文友好
        │         └─ 失败回退 ──▶ lib/pdf.js (Node 自研，FlateDecode+Tj/TJ)
        ├─ structure.js  章节识别 + 元数据（中英文章节别名、页眉过滤）
        ├─ analyzer.js   分析编排（LLM → 启发式回退，evidence 校验）
        ├─ llm.js        LLM 抽象层（openai/anthropic/openai_compatible/heuristic）
        └─ comparer.js · gap.js · qa.js
存储：JSON 文件（data/papers/<id>/ 工件 + data/library.json 索引）
```

## 📁 项目结构

```
ResearchOS/
├── server/            # 主后端（零依赖 Node）
│   ├── server.js
│   └── lib/           # pdf.js / pdf_worker.js / structure.js / analyzer.js / llm.js / ...
├── scripts/
│   ├── pdf_extract.py # PyMuPDF worker
│   ├── make_sample_pdf.js / selftest.js / http_smoke.js
├── frontend/          # 原生 SPA
├── docs/              # architecture / api-spec / database-schema / paper-json-schema
├── backend-fastapi/   # 备选 Python/FastAPI 实现（实验性，非主后端）
├── sample/            # 样例 PDF
└── PROJECT_CONTEXT.md # 项目上下文与阶段状态
```

## 📡 API 一览（详见 `docs/api-spec.md`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/papers` | 上传 PDF（raw bytes + `X-Filename` 头）|
| GET | `/api/papers` | 论文列表 |
| GET | `/api/papers/{id}` | 论文详情 |
| DELETE | `/api/papers/{id}` | 删除论文 |
| POST | `/api/papers/{id}/analyze` | 触发分析 |
| GET/PUT | `/api/papers/{id}/notes` | 读/写笔记 |
| POST | `/api/compare` | 多篇对比 |
| POST | `/api/gaps` | Research Gap |
| POST | `/api/qa` | 论文问答 |

## 🧪 验证

```bash
node scripts/make_sample_pdf.js   # 生成样例 PDF
node scripts/selftest.js          # 进程内跑通 解析→结构化→分析→对比→Gap→问答
node scripts/http_smoke.js        # 逐项验证 HTTP 端点
```

## 🗺 Roadmap（欢迎一起实现）

- **Phase 2 论文知识库**：全文检索增强 + 语义检索（向量库，按需评估）。
- **Phase 3 论文比较升级**：自动聚类、方法分类、时间演化、Research Gap 语义凝练。
- **Phase 4 Research Agent**：论文 → 假设 → 实验设计 → 生成代码 → 运行仿真 → 分析结果。

> 以上方向都欢迎社区共建，也欢迎你提出新的功能方向。

## ⚠️ 已知边界（诚实声明）

- **扫描版/图片 PDF** 无文本层，需 OCR（当前未实现）；PyMuPDF 已覆盖中英文 CID/ToUnicode 文本 PDF。
- 元数据（标题/作者/年份）为规则启发式：无法可靠判断时置 `null` 而非编造；个别复杂排版（竖排刊名、跨行标题）可能不完美。
- 图片当前仅统计数量，不落盘到 `figures/`（`backend-fastapi/` 的 PyMuPDF 版支持内嵌图片抽取）。
- 中文逐字排版 PDF 的"摘要/引言"等竖排或超宽字距标题，可能未被识别（内容仍在正文中）。

## 🤝 欢迎参与共建

ResearchOS 是一个**由社区一起打磨的开放项目**，你的参与能让它更好用：

- **提需求 / 报 Bug**：到 [Issues](https://github.com/sj2821101-design/ResearchOS/issues) 描述你的科研场景或遇到的问题。
- **贡献代码**：Fork → 修改 → 提交 Pull Request，我们会认真 review 每一条。
- **分享真实论文样本**：中文/英文/扫描 PDF 都行——解析质量靠真实数据打磨。
- **交流想法**：在 Issues/Discussions 里聊聊"用 AI 做科研"的痛点与设想，我们一起设计更实用的功能。

**当前特别欢迎的方向：**
- 中英文论文解析的边界用例与回归测试
- 论文问答质量（跨语言、多篇综合）
- 元数据提取（作者/年份/期刊）启发式改进
- UI/UX 优化与国际化（如英文界面）
- Research Agent / 实验仿真方向

**开发约定**：动手改代码前，请先阅读 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) 的 Agent 工作规则与当前阶段状态。

## 📄 License

[MIT](LICENSE)

## 免责声明

`.env`（含 API Key）与 `data/`（含你的论文）均已被 `.gitignore` 忽略，**请勿手动提交**，避免泄露。
