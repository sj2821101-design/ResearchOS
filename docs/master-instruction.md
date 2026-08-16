# ResearchOS V1 · 第一条总指令（可直接交给 Codex/同类 Agent 执行）

> 用途：把本仓库当作"已完成的 V1 基线"，或用下面这条指令从空文件夹重建/继续迭代。
> 指令刻意**分阶段、可复制**，避免一次性失控。

---

## 总指令（复制用）

```
你是高级软件工程师。请实现一个「论文分析工作台 ResearchOS V1」。

## 目标
不是万能科研 AI，而是把这条链跑通：
PDF 导入 → 解析 → 章节结构化 → 16 段模板 + 天基物联网字段分析 → 落盘 → 网页展示 → 多篇对比 → Research Gap → 论文问答。

## 硬约束
1. 零第三方依赖（只用 Node.js 内置模块：http/zlib/fs/path/url/fetch），无需 npm install。
2. 无 API Key 也能端到端运行：内置"本地启发式分析"回退；配置 Key 后切换 LLM。
3. LLM 抽象层：支持 openai / anthropic / openai_compatible(DeepSeek/Ollama/vLLM) / heuristic。

## 功能清单（V1）
① PDF 导入（拖拽），自动提取 标题/作者/摘要/关键词 + 章节（Introduction/Related Work/System Model/Method/Experiments/Conclusion/References）。
② 一键论文拆解，固定 16 段模板输出：
   01 Overview 02 Research Problem 03 Motivation 04 Related Work 05 System Model
   06 Problem Formulation 07 Proposed Method 08 Mathematical Formulation 09 Algorithm
   10 Experiment Design 11 Results 12 Contributions 13 Limitations 14 Research Gap
   15 Possible Extensions 16 My Research Notes
③ 天基物联网额外 10 字段：Satellite Architecture/Constellation Model/Channel Model/Access Model/
   Resource Allocation/Optimization Objective/Algorithm Complexity/Simulation Parameters/
   Baseline Algorithms/Performance Metrics。
④ 多篇对比（技术路线演化/优缺点/Research Gap）⑤ Research Gap 汇总 ⑥ 论文问答 ⑦ 研究笔记。

## 存储
papers/paper_00X/{paper.pdf, metadata.json, sections.json, extracted_text.md, analysis.json, figures/, notes.md}
+ 索引 library.json。论文不能只存 PDF——要建立自己的科研数据库。

## 接口（REST）
POST /api/papers(上传raw bytes+X-Filename)  GET /api/papers  GET /api/papers/{id}
POST /api/papers/{id}/analyze  GET/PUT /api/papers/{id}/notes  POST /api/compare
POST /api/gaps  POST /api/qa  GET /api/health。

## 执行顺序（每步完成并自测后再进行下一步）
1) 分析技术架构，先不写代码；2) 建目录结构；3) PDF 解析模块；4) 章节识别模块；
5) LLM 分析模块（含启发式回退）；6) 对比/Gap/问答；7) HTTP 接口；8) 前端；9) 自测脚本。
```

---

## 已完成基线（本仓库）

上述指令已全部实现并通过自测，见 `server/`、`frontend/`、`scripts/`、`docs/`。
下一步迭代建议从 Phase 2（知识库/向量检索）开始，参考 `README.md` 路线图。
