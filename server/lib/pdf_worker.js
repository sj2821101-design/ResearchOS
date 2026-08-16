'use strict';
// Node → Python(PyMuPDF) → JSON 的 PDF extraction worker。
// 输出通过"临时文件"传递（而非管道），规避部分受限环境对子进程管道 stdio 的拦截。
// 失败时由调用方（server.js）回退到 pdf.js。
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'pdf_extract.py');
const TIMEOUT_MS = 60000;

function resolvePython() {
  // 可配置：优先环境变量，其次 Windows 用 python，否则 python3
  if (process.env.RESEARCHOS_PYTHON && process.env.RESEARCHOS_PYTHON.trim()) {
    return process.env.RESEARCHOS_PYTHON.trim();
  }
  if (process.platform === 'win32') return 'python';
  return process.env.PYTHON || 'python3';
}

/**
 * 用 PyMuPDF worker 提取 PDF 文本与元数据。
 * 返回 { pages, text, numPages, pdfMeta, numFigures, source: 'pymupdf' }。
 * 任何失败（spawn 失败/超时/非0退出/JSON非法/schema不完整）都会 reject。
 */
function extractPdfWithWorker(pdfPath) {
  return new Promise((resolve, reject) => {
    const python = resolvePython();
    const tag = `researchos_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const outFile = path.join(os.tmpdir(), `${tag}.json`);
    const errFile = path.join(os.tmpdir(), `${tag}.err`);

    let errFd;
    try {
      errFd = fs.openSync(errFile, 'w');
    } catch (err) {
      reject(new Error(`PDF worker failed to open err file: ${err && err.message}`));
      return;
    }

    let child;
    try {
      // stdin/stdout 忽略，stderr 重定向到文件；JSON 由 Python 写入 outFile
      child = spawn(python, [SCRIPT, pdfPath, outFile], {
        stdio: ['ignore', 'ignore', errFd],
        windowsHide: true,
      });
    } catch (err) {
      try { fs.closeSync(errFd); } catch (e) { /* ignore */ }
      try { fs.unlinkSync(errFile); } catch (e) { /* ignore */ }
      reject(new Error(`PDF worker spawn failed: ${err && err.message}`));
      return;
    }

    let settled = false;
    const cleanup = () => {
      try { fs.closeSync(errFd); } catch (e) { /* ignore */ }
      try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (e) { /* ignore */ }
      try { if (fs.existsSync(errFile)) fs.unlinkSync(errFile); } catch (e) { /* ignore */ }
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
        cleanup();
        reject(new Error(`PDF worker timeout (${TIMEOUT_MS}ms)`));
      }
    }, TIMEOUT_MS);

    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error(`PDF worker spawn failed: ${err && err.message}`));
      }
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      let stderr = '';
      try { stderr = fs.readFileSync(errFile, 'utf8'); } catch (e) { /* ignore */ }

      if (code !== 0) {
        cleanup();
        reject(new Error(`PDF worker exited ${code}: ${stderr.trim().slice(0, 500)}`));
        return;
      }

      let raw;
      try {
        raw = fs.readFileSync(outFile, 'utf8');
      } catch (e) {
        cleanup();
        reject(new Error(`PDF worker output missing: ${e && e.message}`));
        return;
      }
      cleanup();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        reject(new Error(`PDF worker invalid JSON: ${(e && e.message) || e}`));
        return;
      }
      if (!parsed || typeof parsed !== 'object'
        || !Array.isArray(parsed.pages)
        || typeof parsed.text !== 'string'
        || typeof parsed.numPages !== 'number'
        || !parsed.pdfMeta || typeof parsed.pdfMeta !== 'object') {
        reject(new Error('PDF worker returned incomplete schema'));
        return;
      }
      resolve({
        pages: parsed.pages,
        text: parsed.text,
        numPages: parsed.numPages,
        pdfMeta: parsed.pdfMeta,
        numFigures: typeof parsed.numFigures === 'number' ? parsed.numFigures : 0,
        source: 'pymupdf',
      });
    });
  });
}

module.exports = { extractPdfWithWorker, resolvePython, SCRIPT };
