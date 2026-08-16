#!/usr/bin/env python3
"""ResearchOS PyMuPDF PDF extraction worker（Node → Python → JSON）。

用法：
    python scripts/pdf_extract.py <pdf_path>

输出：
    stdout 一个 JSON，schema 与 Node server/lib/pdf.js 的 extractPdf() 保持一致：
    { "pages": [{ "page": 1, "text": "..." }], "text": "...", "numPages": N,
      "pdfMeta": { "Title": "...", "Author": "...", ... }, "numFigures": 0 }

注意：
    - pdfMeta 的 key 使用首字母大写（Title/Author/...），与 Node parseInfo 一致，
      因为 server/lib/structure.js 按 pdfMeta.Title / pdfMeta.Author / pdfMeta.CreationDate 读取。
    - 任何错误写 stderr 并以非 0 退出，绝不向 stdout 输出半截 JSON。
"""
import json
import re
import sys
from pathlib import Path


def _count_images(doc) -> int:
    """统计 PDF 内嵌图片数量（尽力而为，失败返回 0）。"""
    try:
        total = 0
        for page_index in range(len(doc)):
            total += len(doc.get_page_images(page_index))
        return total
    except Exception:  # noqa: BLE001
        return 0


def _extract_page_text(page) -> str:
    """用 dict 模式按视觉行（bbox）重建文本。

    相比 get_text("text")，它能正确处理中文 PDF 的逐字排版：
    - 同一视觉行的字符（如 "摘"+"要"）会被合并成 "摘要"；
    - 不同视觉行（如 标题 与 作者）保持分行，不再粘连。
    """
    d = page.get_text("dict")
    lines = []
    for block in d.get("blocks", []):
        if block.get("type", 0) != 0:  # 0=文本块，1=图片块
            continue
        for line in block.get("lines", []):
            parts = []
            for span in line.get("spans", []):
                chars = span.get("chars", [])
                if chars:
                    parts.append("".join(ch.get("c", "") for ch in chars))
                else:
                    parts.append(span.get("text", ""))
            text = "".join(parts)
            if text.strip():
                lines.append(text)
    return "\n".join(lines)


def _normalize_text(text: str) -> str:
    """全角转半角（扫描/转换 PDF 常混用全角字符，如 ０１２３／ＡＢＣ／Ｖｏｌ）。"""
    chars = []
    for ch in text:
        code = ord(ch)
        if code == 0x3000:  # 全角空格
            chars.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:  # 全角标点/字母/数字
            chars.append(chr(code - 0xFEE0))
        else:
            chars.append(ch)
    return "".join(chars)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: pdf_extract.py <pdf_path> [out_json_path]", file=sys.stderr)
        return 2

    pdf_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else None
    if not pdf_path.exists():
        print(f"pdf not found: {pdf_path}", file=sys.stderr)
        return 3

    try:
        import pymupdf as fitz  # PyMuPDF 新导入名，避免 fitz 弃用告警污染 stdout
    except ImportError:
        try:
            import fitz  # 兼容旧版 PyMuPDF
        except ImportError as exc:  # pragma: no cover
            print(f"PyMuPDF not installed: {exc}", file=sys.stderr)
            return 4

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as exc:  # noqa: BLE001
        print(f"failed to open pdf: {exc}", file=sys.stderr)
        return 5

    try:
        pages = []
        text_parts = []
        for idx, page in enumerate(doc):
            text = _normalize_text(_extract_page_text(page))
            pages.append({"page": idx + 1, "text": text})
            text_parts.append(text)

        raw_meta = dict(doc.metadata or {})
        num_figures = _count_images(doc)
    finally:
        doc.close()

    result = {
        "pages": pages,
        "text": "\n\n".join(text_parts),
        "numPages": len(pages),
        "pdfMeta": {
            "Title": raw_meta.get("title", "") or "",
            "Author": raw_meta.get("author", "") or "",
            "Subject": raw_meta.get("subject", "") or "",
            "Keywords": raw_meta.get("keywords", "") or "",
            "Creator": raw_meta.get("creator", "") or "",
            "Producer": raw_meta.get("producer", "") or "",
            "CreationDate": raw_meta.get("creationDate", "") or "",
            "ModDate": raw_meta.get("modDate", "") or "",
        },
        "numFigures": num_figures,
    }

    data = json.dumps(result, ensure_ascii=False)
    if out_path is not None:
        # 输出到指定文件（供 Node worker 读取，规避管道限制）
        try:
            out_path.write_text(data, encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            print(f"failed to write output: {exc}", file=sys.stderr)
            return 6
    else:
        try:
            # 直接写 UTF-8 字节，规避 Windows GBK 控制台对非 GBK 字符的 UnicodeEncodeError
            sys.stdout.buffer.write(data.encode("utf-8"))
            sys.stdout.buffer.write(b"\n")
        except Exception:  # noqa: BLE001 - buffer 不可用时回退到 ASCII 安全输出
            json.dump(result, sys.stdout, ensure_ascii=True)
            sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
