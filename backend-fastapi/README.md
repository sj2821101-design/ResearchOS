# backend-fastapi · 可选 Python/FastAPI 版本

> ⚠️ 此目录是 ResearchOS V1 的 **Python/FastAPI 备选实现**（按你会话推荐技术栈编写）。
> 交付环境的机器上没有真实 Python 且外网被断，无法 `pip install`，故**主实现改用零依赖 Node.js**（见仓库根 `server/`）。
> 主实现与备选实现**共用同一套设计**：16 段模板、天基字段、`papers/paper_00X/` 存储、`analysis.json` schema、`/api/*` 路由。

## 何时使用本版本

当你在有 **Python 3.9+ 且可联网** 的机器上，想要 PyMuPDF 的高精度解析（含内嵌图片抽取）时：

```bash
cd backend-fastapi
pip install -r requirements.txt
python run.py          # 等价于 uvicorn app.main:app
```

前端复用仓库根 `frontend/`（由 FastAPI 的 StaticFiles 挂载）；API 路径与 Node 版完全一致。

## 与 Node 版的差异

| 项 | Node 版（主） | Python 版（备选） |
|----|--------------|------------------|
| Web 框架 | 内置 http | FastAPI + Uvicorn |
| PDF 解析 | 零依赖 FlateDecode 抽取 | PyMuPDF（含图片/更稳） |
| 索引 | library.json | SQLite（stdlib sqlite3） |
| LLM | 内置 fetch | httpx |
| 运行依赖 | 无 | requirements.txt |
