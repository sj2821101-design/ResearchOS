"""PDF 解析引擎（Phase 1 使用 PyMuPDF / fitz）。

提取：逐页文本、PDF 元数据、嵌入图片（保存到 figures/）。
注意：公式/表格在 Phase 1 以文本形式一并抓取；更精细的公式/表格识别
留给后续接入 Marker / GROBID / Docling。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from ..store import store


def extract_pdf(paper_id: str, pdf_path: Path) -> Dict[str, Any]:
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "未安装 PyMuPDF。请先执行: pip install -r requirements.txt"
        ) from exc

    doc = fitz.open(str(pdf_path))
    try:
        pages: List[Dict[str, Any]] = []
        text_parts: List[str] = []
        for idx, page in enumerate(doc):
            text = page.get_text("text")
            pages.append({"page": idx + 1, "text": text})
            text_parts.append(text)

        raw_meta = dict(doc.metadata or {})
        num_figures = _extract_figures(doc, paper_id)
    finally:
        doc.close()

    return {
        "pages": pages,
        "text": "\n\n".join(text_parts),
        "num_pages": len(pages),
        "pdf_meta": raw_meta,
        "num_figures": num_figures,
    }


def _extract_figures(doc: Any, paper_id: str) -> int:
    """抽取 PDF 内嵌图片到 papers/<id>/figures/，返回数量。"""
    fdir = store.paper_dir(paper_id) / "figures"
    fdir.mkdir(exist_ok=True)
    count = 0
    seen: set = set()
    for page_index in range(len(doc)):
        for img in doc.get_page_images(page_index):
            xref = img[0]
            if xref in seen:
                continue
            seen.add(xref)
            try:
                info = doc.extract_image(xref)
                ext = info.get("ext", "png")
                if ext not in {"png", "jpeg", "jpg", "bmp", "tiff", "gif"}:
                    ext = "png"
                out = fdir / f"fig_{page_index + 1:03d}_{count + 1:02d}.{ext}"
                out.write_bytes(info.get("image", b""))
                count += 1
            except Exception:  # noqa: BLE001 - 单个图片失败不阻断整体
                continue
    return count
