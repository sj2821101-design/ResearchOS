# ResearchOS · AI Paper Analysis Workbench

> A local AI paper analysis platform for researchers: turn PDFs into structured research knowledge, with **evidence-grounded deep analysis** and **paper Q&A**.

> **🤝 Open for collaboration**: an open-source project that gets better together — feature requests, bug reports, code contributions, and paper samples are all welcome. See [Contributing](#-contributing).

```
PDF import → Parse (CN/EN) → Sections/Metadata → 16-section template + Satellite-IoT fields
        → Evidence-grounded analysis → Persistence → Web UI → Compare → Research Gap → Q&A
```

## ✨ Features

- **Chinese / complex-font PDF support**: built on PyMuPDF, correctly handles Chinese CID / ToUnicode / complex fonts.
- **Evidence-grounded analysis**: every AI conclusion links to a **verbatim quote** from the paper, locally verified (`verified` only if the quote actually exists in the source text).
- **16-section paper breakdown** + **10 satellite-IoT fields** (tailored for satellite communications / space-terrestrial IoT research).
- **Evidence grading**: `paper_stated` (explicitly stated) / `derived` (reasonably inferred) / `speculative` (hypothesis).
- **Paper Q&A**: cross-language (ask in Chinese about English papers), auto-falls back to full-text context.
- **Zero npm dependencies**: Node.js built-in `http` + `zlib` + `fetch` — no `npm install` needed.
- **Runs without any API key**: built-in heuristic analysis fallback; switch to deep analysis with DeepSeek / OpenAI / Claude / Ollama.
- **Fully localized UI**, AI analysis output defaults to Simplified Chinese.

## 🚀 Quick Start

**Prereq**: Node.js ≥ 18 (zero npm deps). Python is optional (needed only for Chinese / complex PDFs).

```bash
git clone https://github.com/sj2821101-design/ResearchOS.git
cd ResearchOS
node server/server.js          # Windows: or double-click start.bat
```

Open **http://127.0.0.1:8000** and drag in a PDF.

> A sample paper `sample/sample_satellite_iot.pdf` (satellite IoT theme) is included for a quick demo.

### Optional: best Chinese PDF parsing

System Python needs PyMuPDF:

```bash
pip install pymupdf
```

If PyMuPDF lives in a non-system Python, point the worker to it:

```bash
# Windows PowerShell
$env:RESEARCHOS_PYTHON="E:\your\python.exe"
node server/server.js
```

> Without PyMuPDF, it automatically falls back to the built-in Node parser (fine for English PDFs; Chinese / complex fonts will be garbled).

### Configure LLM (optional)

Copy `.env.example` to `.env` and fill one provider:

```bash
# DeepSeek (OpenAI-compatible endpoint)
LLM_PROVIDER=openai_compatible
LLM_MODEL=deepseek-chat
OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com/v1
OPENAI_COMPATIBLE_API_KEY=sk-xxxx

# or OpenAI / Claude / Ollama / vLLM
# LLM_PROVIDER=openai              OPENAI_API_KEY=...
# LLM_PROVIDER=anthropic           ANTHROPIC_API_KEY=...
# LLM_PROVIDER=openai_compatible   OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434/v1  (Ollama)
```

Without a key, the built-in heuristic analysis is used.

## 🧩 16-Section Analysis Template

| # | Field | # | Field |
|---|-------|---|-------|
| 01 | Paper Overview | 09 | Algorithm |
| 02 | Research Problem | 10 | Experiment Design |
| 03 | Motivation | 11 | Results |
| 04 | Related Work | 12 | Contributions |
| 05 | System Model | 13 | Limitations |
| 06 | Problem Formulation | 14 | Research Gap |
| 07 | Proposed Method | 15 | Possible Extensions |
| 08 | Mathematical Formulation | 16 | My Research Notes |

**Satellite-IoT fields**: Satellite Architecture · Constellation Model · Channel Model · Access Model · Resource Allocation · Optimization Objective · Algorithm Complexity · Simulation Parameters · Baseline Algorithms · Performance Metrics

## 🏗 Architecture

```
Frontend: vanilla HTML/CSS/JS (static SPA, zero build)
        │ HTTP /api/*
Backend : Node.js built-in http (zero deps)
        ├─ pdf_worker.js ──spawn──▶ scripts/pdf_extract.py (PyMuPDF)  ← primary, Chinese-friendly
        │         └─ fallback ──▶ lib/pdf.js (built-in, FlateDecode + Tj/TJ)
        ├─ structure.js  section detection + metadata (CN/EN aliases, header noise filter)
        ├─ analyzer.js   analysis orchestration (LLM → heuristic fallback, evidence validation)
        ├─ llm.js        LLM abstraction (openai / anthropic / openai_compatible / heuristic)
        └─ comparer.js · gap.js · qa.js
Storage: JSON files (data/papers/<id>/ artifacts + data/library.json index)
```

## 📁 Project Structure

```
ResearchOS/
├── server/            # Main backend (zero-dep Node)
│   ├── server.js
│   └── lib/           # pdf.js / pdf_worker.js / structure.js / analyzer.js / llm.js / ...
├── scripts/
│   ├── pdf_extract.py # PyMuPDF worker
│   ├── make_sample_pdf.js / selftest.js / http_smoke.js
├── frontend/          # Vanilla SPA
├── docs/              # architecture / api-spec / database-schema / paper-json-schema
├── backend-fastapi/   # Experimental Python/FastAPI alternative (not the main backend)
├── sample/            # Sample PDF
└── PROJECT_CONTEXT.md # Project context and phase status
```

## 📡 API (see `docs/api-spec.md` for details)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/papers` | Upload PDF (raw bytes + `X-Filename` header) |
| GET | `/api/papers` | List papers |
| GET | `/api/papers/{id}` | Paper detail |
| DELETE | `/api/papers/{id}` | Delete paper |
| POST | `/api/papers/{id}/analyze` | Run analysis |
| GET/PUT | `/api/papers/{id}/notes` | Read/write notes |
| POST | `/api/compare` | Multi-paper comparison |
| POST | `/api/gaps` | Research Gap |
| POST | `/api/qa` | Paper Q&A |

## 🧪 Testing

```bash
node scripts/make_sample_pdf.js   # generate sample PDF
node scripts/selftest.js          # in-process: parse → structure → analyze → compare → gap → QA
node scripts/http_smoke.js        # verify all HTTP endpoints
```

## 🗺 Roadmap (help wanted)

- **Phase 2 Paper Knowledge Base**: full-text search enhancement + semantic search (vector DB, evaluated on demand).
- **Phase 3 Comparison Upgrade**: auto-clustering, method classification, temporal evolution, semantic Research Gap synthesis.
- **Phase 4 Research Agent**: paper → hypothesis → experiment design → code generation → simulation → result analysis.

> All of the above are open for community contribution — and new directions are welcome too.

## 🤝 Contributing

ResearchOS is an **open-source project shaped by its community** — your involvement makes it better:

- **Feature requests / Bug reports**: open an [Issue](https://github.com/sj2821101-design/ResearchOS/issues) describing your research scenario or the problem you hit.
- **Code contributions**: Fork → edit → Pull Request; every PR is reviewed carefully.
- **Share real paper samples**: Chinese / English / scanned PDFs all help — parsing quality is honed on real data.
- **Ideas & discussion**: chat about "AI for research" pain points and ideas in Issues/Discussions.

**Particularly welcome:**
- Edge cases & regression tests for CN/EN PDF parsing
- Paper Q&A quality (cross-language, multi-paper synthesis)
- Heuristic improvements for metadata extraction (authors / year / venue)
- UI/UX polish & internationalization (e.g., an English UI)
- Research Agent / experiment & simulation direction

**Before coding**: please read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the agent working rules and current phase status.

## ⚠️ Known Limitations (honest notes)

- **Scanned / image-only PDFs** have no text layer and need OCR (not implemented yet); PyMuPDF covers Chinese/English CID/ToUnicode text PDFs.
- Metadata (title/authors/year) is rule-based: it returns `null` when uncertain rather than fabricating; exotic layouts (vertical mastheads, wrapped titles) may be imperfect.
- Images are currently counted but not saved to `figures/` (the `backend-fastapi/` PyMuPDF variant extracts embedded images).
- For CJK PDFs with per-character line-breaking, headings like "摘要/引言" may not be detected (the content remains in the body text).

## 📄 License

[MIT](LICENSE)

## Disclaimer

`.env` (API keys) and `data/` (your papers) are gitignored — **never commit them**, to avoid leaking secrets.
