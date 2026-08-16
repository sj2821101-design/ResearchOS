# Changelog

本文件记录 ResearchOS 的版本演进。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### Added
- 论文删除功能（`DELETE /api/papers/{id}` + 前端 ✕ 按钮）
- 界面全面汉化（16 段模板、天基字段、原始章节名）
- AI 分析输出改为简体中文（证据 quote 保持原文）
- 论文问答跨语言回退（检索无命中时用摘要+关键章节作为上下文）
- LLM 请求超时（120s AbortController）
- PDF 上传大小限制（50MB）
- `CHANGELOG.md`

### Changed
- 多行作者提取（支持抓全所有作者，去除数字上标）
- 年份优先级调整（正文出版上下文 > PDF 元数据日期）

## [1.0.0] - Phase 1C-0

### Added
- PyMuPDF PDF Worker（`scripts/pdf_extract.py` + `server/lib/pdf_worker.js`）
- Node → Python Worker 失败回退到 Node pdf.js
- 中文 CID/ToUnicode/复杂字体 PDF 正确解码
- 中文章节别名（摘要/关键词/引言/相关工作/系统模型/算法/实验/结论/参考文献）
- 页眉页脚噪声过滤（IEEE/VOL/NO/DOI/ISSN/年月/全大写刊名/竖排刊名）
- 中文文件名保留（仅过滤 Windows 非法字符）

## [0.3.0] - Phase 1B

### Added
- 论文分析原文证据（`evidence[]`，含 verified 校验）
- 证据类型区分：paper_stated / derived / speculative
- Research Gap 分级（`research_gap_details`）
- 前端 Evidence 展示

### Changed
- 论文年份元数据误判修复（正文数字不再误判为年份）

## [0.2.0] - Phase 1A

### Added
- DeepSeek（openai_compatible）真实 API 接入与端到端验证
- LLM 抽象层（openai / anthropic / openai_compatible / heuristic）

### Fixed
- analysis prompt 的 section key 映射问题
- LLM temperature / max_tokens 默认参数

## [0.1.0] - 初始版本

### Added
- 零依赖 Node.js 后端（原生 http + zlib + fetch）
- PDF 文本抽取（Node 自研，FlateDecode + Tj/TJ）
- 章节识别 + 元数据提取
- 16 段论文分析模板 + 天基物联网字段
- 原生 HTML/CSS/JS 前端（上传/列表/详情/对比/Gap/问答/笔记）
- 本地启发式分析回退
