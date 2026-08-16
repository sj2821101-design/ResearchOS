# ResearchOS Project Context

## 1. 项目定位

ResearchOS 是一个面向科研人员的 AI 论文分析与科研辅助平台。

第一阶段目标：

> 将科研论文从 PDF 转换为结构化科研知识，并提供深度技术分析和论文问答能力。

长期目标：

> 从论文阅读工具逐步发展成为个人科研 AI Assistant。

---

## 2. 主要用户

主要面向：

- 硕士研究生
- 博士研究生
- 科研人员

重点科研方向：

- 通信
- 卫星通信
- 天基物联网
- 计算机网络
- 人工智能
- 机器学习

---

## 3. V1 核心目标

ResearchOS V1 应实现：

PDF论文
↓
论文上传
↓
PDF解析
↓
文本提取
↓
论文结构识别
↓
AI论文分析
↓
结构化分析结果
↓
数据库保存
↓
网页展示
↓
单篇论文问答

---

## 4. V1核心功能

### 论文上传

- PDF上传
- 文件保存
- 文件大小限制
- 错误处理
- 上传状态反馈

### PDF解析

第一阶段优先使用：

PyMuPDF

需要逐步实现：

- 页面文本
- 页码
- 标题
- 作者
- 摘要
- 章节
- 参考文献

### AI论文分析

至少分析：

- Paper Overview
- Research Problem
- Motivation
- Related Work
- System Model
- Problem Formulation
- Methodology
- Algorithm
- Experiment Design
- Results
- Contributions
- Limitations
- Research Gaps

---

## 5. 天基物联网扩展

未来针对卫星通信和天基物联网论文重点提取：

- Satellite Architecture
- Constellation Model
- Orbit Information
- Channel Model
- Link Model
- Access Model
- Resource Allocation
- Routing
- Scheduling
- Optimization Objective
- Problem Formulation
- Algorithm
- Algorithm Complexity
- Baseline Algorithms
- Simulation Parameters
- Performance Metrics

这些功能不要求在V1全部实现。

---

## 6. 当前实际技术栈

> 重要：本节以「当前实际代码」为准，不再以 Next.js + React + TypeScript + FastAPI 作为当前技术栈。
> 后者曾是早期目标架构，现已明确降级为「未来可评估选项」。

### Frontend（主实现）

- 原生 HTML
- CSS
- Vanilla JavaScript

（当前不使用 Next.js / React / TypeScript / Tailwind CSS）

### Backend（主实现）

- Node.js
- Node 内置 http
- Node 内置 zlib
- fetch（内置）

### Database

- 当前使用 JSON 文件索引 + 文件系统
- library.json（索引）
- data/papers/<id>/（每篇论文的工件目录）

（当前不使用 SQLite / SQLAlchemy / ORM）

### PDF

- 主解析：PyMuPDF PDF Worker（`scripts/pdf_extract.py` + `server/lib/pdf_worker.js`，Node spawn 调用）
- Fallback：Node 自研 PDF 文本提取（`server/lib/pdf.js`，zlib + FlateDecode + Tj/TJ）
- 中文/CID/ToUnicode/复杂字体 PDF 由 PyMuPDF 解决；扫描版/OCR 仍未支持

### AI

- 当前支持 heuristic（本地启发式分析，无需 API Key）
- 已存在 LLM abstraction（独立 LLM Service 抽象层）
- 支持：openai / anthropic / openai_compatible
- openai_compatible 覆盖 DeepSeek / Ollama / vLLM 等兼容接口
- 真实 LLM 已完成 DeepSeek 端到端验证（analysis 链路）

### 备选实现

- backend-fastapi/ 是备用实验实现（Python + FastAPI + PyMuPDF + SQLite），不是当前主后端。
- 暂时不要迁移到 FastAPI。

### 技术路线

ResearchOS V1 不进行大规模技术栈迁移。

优先使用当前可运行的 Node.js 架构完成 V1。

未来只有在出现明确性能、维护性或功能需求时，再评估：

- FastAPI
- SQLite / PostgreSQL
- PyMuPDF
- React / Next.js

---

## 7. 工程原则

### 功能优先于技术栈一致性

当前阶段禁止为了追求理想技术栈而重写已经可运行的代码。

### 模块化

以下模块应该尽可能解耦：

PDF Parser
LLM Service
Database
API
Frontend

### 可扩展

未来可能加入：

- RAG
- 向量数据库
- 多论文比较
- Research Gap
- 知识图谱
- Research Agent
- 自动实验设计
- 自动代码生成

### 不过度工程化

V1首先保证：

PDF
↓
解析
↓
分析
↓
保存
↓
展示

这一完整链路真正运行。

### 安全

禁止：

- API Key写死在代码
- API Key提交到Git
- API Key暴露给前端

---

## 8. 开发阶段

当前阶段：

**Phase 1：ResearchOS V1 核心能力完善**

（Phase 0：项目接管与代码审计 —— ✅ 已完成）

### Phase 1 子阶段（当前开发路线）

- Phase 1A：真实LLM接入与验证 —— ✅ 已完成
- Phase 1B：Evidence-Grounded Analysis + Metadata Reliability —— ✅ 已完成
- Phase 1C：论文问答升级 —— ⏳ 下一阶段
- Phase 1C-0：PDF Ingestion Reliability —— ✅ 已完成
- Phase 1D：PDF解析可靠性升级 —— ✅ 已完成（即 Phase 1C-0）
- Phase 1E：数据层整理
- Phase 1F：用户体验优化

### 后续阶段（长远）

- Phase 2：论文知识库
- Phase 3：RAG
- Phase 4：多论文比较升级
- Phase 5：Research Gap
- Phase 6：Research Agent
- Phase 7：自动实验设计与代码生成

---

## 9. 当前状态

当前处于：

**Phase 1B：Evidence-Grounded Analysis + Metadata Reliability —— ✅ 已完成**

### 当前完成度

约 75%

> 注：这是基于当前代码审计的估算，非精确测量；Phase 1A 已完成后，主要缺口转移到分析质量与问答升级。

### 已完成

- PDF上传
- PDF保存
- PDF文本提取
- 论文列表
- 论文详情
- 分析结果保存
- 基础论文结构分析
- 基础论文问答
- compare API
- gaps API
- LLM abstraction
- DeepSeek（openai_compatible）真实 API 接入
- sample_satellite_iot.pdf 真实端到端分析
- analysis.json 成功生成（provider=openai_compatible）
- 论文年份等元数据启发式误判修复（正文数字不再误判为年份）
- AI 分析结果原文 Evidence（quote 逐字匹配原文，verified 校验）
- Research Gap 证据等级（paper_stated / derived / speculative + research_gap_details）
- 前端 Evidence 展示（每个分析字段可查看原文证据）

### 部分完成

- PDF解析：自研提取器可用；扫描版 / CID 字体 / ToUnicode 不支持
- AI论文分析：DeepSeek 真实接入 + Evidence 关联已完成；speculative 类证据覆盖较少
- 论文问答：英文问题已验证 DeepSeek 回答；中文问题跨语言检索缺失
- 数据库：JSON 文件持久化可用；非 SQLite

### 未完成

- 论文问答跨语言检索
- 文件大小限制
- 页码持久化
- 参考文献结构化
- 图片抽取（Node 版）
- CHANGELOG.md

### 当前Bug

- 无 P0 级问题（详见下方问题清单）

### 技术债务

- 两套后端并存（Node 主实现 + backend-fastapi 备用）
- Node LLM fetch 无超时
- 元数据启发式存在误判（如年份）
- server.log 残留文件

### 问题清单（按严重程度）

P0：

- 无

P1：

- PDF解析兼容性不足
- 当前数据库仍是JSON文件
- 论文问答需要升级（跨语言检索缺失）

P2：

- LLM timeout
- 文件大小限制
- 页码持久化
- 参考文献结构化
- 图片抽取
- CHANGELOG

---

## Development History

### Phase 0：项目接管与代码审计 —— ✅ 已完成

- 完成全项目代码审计
- 确认为 Node.js 主实现 + backend-fastapi 备用实现

### Phase 1A：真实LLM接入与验证 —— ✅ 已完成

- 修复 analysis prompt 的 section key 映射问题
- 修复 LLM temperature / max_tokens 默认参数
- DeepSeek openai_compatible 已完成真实 API 接入
- sample_satellite_iot.pdf 已完成真实端到端分析
- analysis.json 已成功生成
- DeepSeek 返回模型为 deepseek-v4-flash
- 未发生 analysis heuristic fallback

### Phase 1B：Evidence-Grounded Analysis + Metadata Reliability —— ✅ 已完成

- 修复论文年份等元数据启发式误判（structure.js 新增 extractYear：年份仅从 PDF 元数据日期或出版上下文标记提取，正文数字不再误判；示例论文 year 正确为 null）
- 为 AI 分析结果新增 evidence 结构（id / section / quote / type / supports / verified）
- evidence 类型区分：paper_stated / derived / speculative
- analyzer.js 本地 evidence 校验（normalize 后 quote 与原文 section 匹配，标 verified）
- Research Gap 升级：保留 research_gap 字符串数组 + 新增 research_gap_details（statement / type / evidence_ids）
- 前端最小 Evidence 展示（app.js / styles.css）
- 测试：node --check 全过；selftest（heuristic）DONE 无 ERROR；DeepSeek E2E（evidence 14 条全部 verified、research_gap_details 2 条）；旧论文兼容

### Phase 1C-0：PDF Ingestion Reliability —— ✅ 已完成

- 新增 `scripts/pdf_extract.py`（PyMuPDF worker，输出 camelCase schema，UTF-8 字节写 stdout）
- 新增 `server/lib/pdf_worker.js`（Node spawn 调 Python，60s 超时，失败 reject）
- 修改 `server/server.js`：ingest 改为 worker 优先 + pdf.js fallback
- 修改 `server/lib/structure.js`：中文章节别名（摘要/关键词/引言/相关工作/系统模型/算法/实验/结论/参考文献）+ 页眉页脚噪声过滤（IEEE/VOL/NO/DOI/ISSN/年月/全大写刊名）
- 修改 `server/lib/store.js`：文件名保留 Unicode，仅过滤 Windows 非法字符与保留设备名
- 中文/CID/ToUnicode 乱码由 PyMuPDF 解决（实测 paper_006 标题正确解码为「不确定系统改进的鲁棒协方差交叉融合稳态Kalman预报器」）
- 测试：node --check/py_compile 全过；selftest DONE；DeepSeek E2E（evidence 15 条全部 verified）；旧论文兼容
- 仍存在问题：扫描版/OCR 未支持；中文逐字排版 PDF 的编号章节/标题作者粘连；页码未持久化

---

## Current Phase

**Phase 1C-0：PDF Ingestion Reliability**

**Status：COMPLETED**

> 已完成：PyMuPDF Worker + fallback、中文乱码解决、中文章节/文件名、页眉过滤。

### Phase 1C-0 目标

PDF → Text → Metadata → Sections 这一 ingestion 管线的可靠性。

### 下一阶段

Phase 1C：论文问答升级（尚未开始）

---

## 10. Agent工作规则

任何AI Agent修改代码之前：

1. 必须先阅读 PROJECT_CONTEXT.md
2. 阅读相关代码
3. 理解现有架构
4. 确认修改范围
5. 避免无关重构

完成任务以后：

1. 运行相关测试
2. 检查项目启动状态
3. 更新 PROJECT_CONTEXT.md
4. 更新 CHANGELOG.md
5. 汇报修改内容
6. 汇报测试结果
7. 汇报剩余问题

---

## 11. 当前任务

当前阶段目标：完成 Phase 1（ResearchOS V1 核心能力完善）。

当前子阶段：**Phase 1C：论文问答升级（下一阶段）**（Phase 1C-0 PDF Ingestion 已完成）。

优先级顺序（按 Phase 1 子阶段）：

1. Phase 1A：真实LLM接入与验证 —— ✅ 已完成
2. Phase 1B：Evidence-Grounded Analysis + Metadata Reliability —— ✅ 已完成
3. Phase 1C：论文问答升级 —— ⏳ 下一阶段
4. Phase 1D：PDF解析可靠性升级
5. Phase 1E：数据层整理
6. Phase 1F：用户体验优化

技术路线约束：

- 不进行大规模技术栈迁移
- 优先使用当前可运行的 Node.js 架构
- 功能优先于技术栈一致性

---

## 12. 长期目标

ResearchOS最终希望实现：

论文
↓
自动理解
↓
知识提取
↓
知识库
↓
多论文比较
↓
研究趋势
↓
Research Gap
↓
研究问题
↓
研究假设
↓
实验设计
↓
代码生成
↓
实验运行
↓
结果分析
↓
科研迭代

最终成为能够辅助科研人员完成：

阅读 → 理解 → 分析 → 发现问题 → 设计研究 → 实验验证

全过程的科研AI系统。
