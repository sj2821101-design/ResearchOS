"""ResearchOS V1 REST API。

全部端点挂载在 /api 前缀下：
    POST   /api/papers                     上传 PDF（multipart）
    GET    /api/papers                     论文列表
    GET    /api/papers/{id}                论文详情（元数据 + 章节 + 分析 + 笔记）
    POST   /api/papers/{id}/analyze        触发分析
    GET    /api/papers/{id}/notes          读取笔记
    PUT    /api/papers/{id}/notes          保存笔记
    GET    /api/papers/{id}/figures/{name} 查看抽取的图片
    POST   /api/compare                    多篇对比
    POST   /api/gaps                       Research Gap
    POST   /api/qa                         论文问答
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .. import db, schemas
from ..store import store
from ..services import analyzer, comparer, gap, ingest, qa

router = APIRouter()


# ---------- 健康检查 ----------
@router.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "version": "1.0.0", "papers": len(db.list_papers())}


# ---------- 论文导入 / 列表 / 详情 ----------
@router.post("/papers", response_model=Dict[str, Any])
def upload_paper(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="上传文件为空")
    return ingest.ingest_pdf(file.filename, content)


@router.get("/papers", response_model=list[schemas.PaperListItem])
def list_papers() -> list[schemas.PaperListItem]:
    return [schemas.PaperListItem.model_validate(row) for row in db.list_papers()]


@router.get("/papers/{paper_id}", response_model=schemas.PaperDetail)
def get_paper(paper_id: str) -> schemas.PaperDetail:
    row = db.get_paper(paper_id)
    if not row:
        raise HTTPException(status_code=404, detail="论文不存在")
    return schemas.PaperDetail(
        id=paper_id,
        metadata=store.get_metadata(paper_id),
        sections=store.get_sections(paper_id),
        analysis=store.get_analysis(paper_id),
        notes=store.get_notes(paper_id),
        has_pdf=store.pdf_path(paper_id) is not None,
        figures=store.list_figures(paper_id),
    )


@router.get("/papers/{paper_id}/figures/{name}")
def get_figure(paper_id: str, name: str) -> FileResponse:
    if not store.exists(paper_id):
        raise HTTPException(status_code=404, detail="论文不存在")
    safe = Path(name).name
    path = store.paper_dir(paper_id) / "figures" / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="图片不存在")
    return FileResponse(path)


# ---------- 分析 ----------
@router.post("/papers/{paper_id}/analyze")
def analyze(paper_id: str, req: schemas.AnalyzeRequest) -> Dict[str, Any]:
    if not store.exists(paper_id):
        raise HTTPException(status_code=404, detail="论文不存在")
    return analyzer.analyze_paper(paper_id, req.provider, req.model, req.include_satellite)


# ---------- 笔记 ----------
@router.get("/papers/{paper_id}/notes")
def get_notes(paper_id: str) -> Dict[str, str]:
    if not store.exists(paper_id):
        raise HTTPException(status_code=404, detail="论文不存在")
    return {"notes": store.get_notes(paper_id)}


@router.put("/papers/{paper_id}/notes")
def save_notes(paper_id: str, req: schemas.NotesRequest) -> Dict[str, str]:
    if not store.exists(paper_id):
        raise HTTPException(status_code=404, detail="论文不存在")
    store.set_notes(paper_id, req.notes)
    return {"notes": req.notes}


# ---------- 对比 / Gap / 问答 ----------
@router.post("/compare")
def compare(req: schemas.CompareRequest) -> Dict[str, Any]:
    _ensure_exist(req.paper_ids)
    return comparer.compare_papers(req.paper_ids, req.provider, req.model)


@router.post("/gaps")
def gaps(req: schemas.GapRequest) -> Dict[str, Any]:
    _ensure_exist(req.paper_ids)
    return gap.find_gaps(req.paper_ids, req.provider, req.model)


@router.post("/qa")
def ask(req: schemas.QARequest) -> Dict[str, Any]:
    _ensure_exist(req.paper_ids)
    return qa.answer_question(req.paper_ids, req.question, req.provider, req.model)


def _ensure_exist(paper_ids: list[str]) -> None:
    missing = [pid for pid in paper_ids if not store.exists(pid)]
    if missing:
        raise HTTPException(status_code=404, detail=f"论文不存在: {', '.join(missing)}")
