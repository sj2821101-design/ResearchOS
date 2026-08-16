'use strict';
// ResearchOS V1 HTTP 服务（零依赖，纯 Node 内置模块）。
// 启动：node server.js   （默认 127.0.0.1:8000，可用 RESEARCHOS_PORT 覆盖）
const http = require('http');
const fs = require('fs');
const path = require('path');

const config = require('./lib/config');
const store = require('./lib/store');
const pdf = require('./lib/pdf');
const pdfWorker = require('./lib/pdf_worker');
const structure = require('./lib/structure');
const analyzer = require('./lib/analyzer');
const comparer = require('./lib/comparer');
const gap = require('./lib/gap');
const qa = require('./lib/qa');
const { now } = require('./lib/util');

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB

const FRONTEND_DIR = path.join(config.projectRoot, 'frontend');

store.ensureDirs();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Filename',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS));
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch (e) { return {}; }
}

function serveStatic(res, pathname) {
  let rel = pathname.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  if (rel.startsWith('static/')) rel = rel.slice('static/'.length);
  const file = path.resolve(FRONTEND_DIR, rel);
  if (!file.startsWith(FRONTEND_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return sendJson(res, 404, { detail: 'not found' });
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, CORS));
  fs.createReadStream(file).pipe(res);
}

async function extractPdfSmart(pdfPath, buf) {
  try {
    return await pdfWorker.extractPdfWithWorker(pdfPath);
  } catch (err) {
    console.error('[pdf] PyMuPDF worker failed, falling back to Node pdf.js:', err && err.message);
    return pdf.extractPdf(buf);
  }
}

async function ingest(filename, buf) {
  const id = store.nextId();
  const saved = store.savePdf(id, filename, buf);
  const parsed = await extractPdfSmart(saved, buf);
  const meta = structure.extractMetadata(parsed.text, parsed.pdfMeta || {});
  const sections = structure.detectSections(parsed.text);

  store.writeJson(id, 'metadata.json', meta);
  store.writeJson(id, 'sections.json', sections);
  store.writeText(id, 'extracted_text.md', parsed.text);
  store.writeText(id, 'notes.md', '');

  store.upsertPaper({
    id,
    filename: path.basename(saved),
    title: meta.title || '',
    authors: meta.authors || [],
    year: meta.year || null,
    venue: meta.venue || '',
    doi: meta.doi || '',
    keywords: meta.keywords || [],
    sectionCount: Object.keys(sections).length,
    analysisStatus: 'parsed',
    analysisProvider: null,
    analysisModel: null,
    createdAt: now(),
  });

  return {
    id,
    filename: path.basename(saved),
    metadata: meta,
    num_pages: parsed.numPages,
    num_sections: Object.keys(sections).length,
    num_figures: parsed.numFigures,
    source: parsed.source,
    title: meta.title || '',
  };
}

function getDetail(id) {
  return {
    id,
    metadata: store.readJson(id, 'metadata.json', {}),
    sections: store.readJson(id, 'sections.json', {}),
    analysis: store.readJson(id, 'analysis.json', null),
    notes: store.readText(id, 'notes.md', ''),
    has_pdf: store.pdfPath(id) != null,
    figures: store.listFigures(id),
  };
}

async function handle(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  const method = req.method;

  if (method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  try {
    // ---- 健康检查 ----
    if (p === '/api/health' && method === 'GET') {
      return sendJson(res, 200, { status: 'ok', version: '1.0.0', papers: store.listPapers().length });
    }

    // ---- 论文导入 / 列表 ----
    if (p === '/api/papers' && method === 'GET') {
      return sendJson(res, 200, store.listPapers());
    }
    if (p === '/api/papers' && method === 'POST') {
      const filename = decodeURIComponent(req.headers['x-filename'] || 'paper.pdf');
      const buf = await readBody(req);
      if (!buf.length) return sendJson(res, 400, { detail: '上传内容为空' });
      if (buf.length > MAX_PDF_BYTES) return sendJson(res, 400, { detail: '文件超过 50MB 大小限制' });
      return sendJson(res, 201, await ingest(filename, buf));
    }

    // ---- 论文详情 / 分析 / 笔记 / 图片 / 删除 ----
    let m = p.match(/^\/api\/papers\/([^/]+)$/);
    if (m && method === 'GET') {
      if (!store.exists(m[1])) return sendJson(res, 404, { detail: '论文不存在' });
      return sendJson(res, 200, getDetail(m[1]));
    }
    if (m && method === 'DELETE') {
      if (!store.exists(m[1])) return sendJson(res, 404, { detail: '论文不存在' });
      store.deletePaper(m[1]);
      return sendJson(res, 200, { deleted: m[1] });
    }
    m = p.match(/^\/api\/papers\/([^/]+)\/analyze$/);
    if (m && method === 'POST') {
      if (!store.exists(m[1])) return sendJson(res, 404, { detail: '论文不存在' });
      const body = await readJsonBody(req);
      return sendJson(res, 200, await analyzer.analyzePaper(m[1], body));
    }
    m = p.match(/^\/api\/papers\/([^/]+)\/notes$/);
    if (m && method === 'GET') {
      if (!store.exists(m[1])) return sendJson(res, 404, { detail: '论文不存在' });
      return sendJson(res, 200, { notes: store.readText(m[1], 'notes.md', '') });
    }
    if (m && method === 'PUT') {
      if (!store.exists(m[1])) return sendJson(res, 404, { detail: '论文不存在' });
      const body = await readJsonBody(req);
      store.writeText(m[1], 'notes.md', body.notes || '');
      return sendJson(res, 200, { notes: body.notes || '' });
    }
    m = p.match(/^\/api\/papers\/([^/]+)\/figures\/([^/]+)$/);
    if (m && method === 'GET') {
      const fdir = path.join(store.paperDir(m[1]), 'figures');
      const file = path.resolve(fdir, path.basename(m[2]));
      if (!file.startsWith(fdir) || !fs.existsSync(file)) return sendJson(res, 404, { detail: '图片不存在' });
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, CORS));
      return fs.createReadStream(file).pipe(res);
    }

    // ---- 对比 / Gap / 问答 ----
    if (p === '/api/compare' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await comparer.comparePapers(body.paper_ids || [], body));
    }
    if (p === '/api/gaps' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await gap.findGaps(body.paper_ids || [], body));
    }
    if (p === '/api/qa' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await qa.answerQuestion(body.paper_ids || [], body.question || '', body));
    }

    // ---- 静态前端 ----
    if (method === 'GET') return serveStatic(res, p);
    return sendJson(res, 404, { detail: 'not found' });
  } catch (e) {
    return sendJson(res, 500, { detail: String((e && e.message) || e) });
  }
}

const server = http.createServer(handle);
server.listen(config.port, config.host, () => {
  console.log(`ResearchOS V1 running at http://${config.host}:${config.port}`);
  console.log(`Data dir: ${config.dataDir}`);
});

module.exports = { server, ingest };
