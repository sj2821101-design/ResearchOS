'use strict';
// 论文工件存储 + 索引（library.json，等价于 SQLite 索引的角色）。
// 目录结构：data/papers/paper_001/{paper.pdf, metadata.json, sections.json,
//           extracted_text.md, analysis.json, notes.md, figures/}
const fs = require('fs');
const path = require('path');
const config = require('./config');

const papersRoot = path.join(config.dataDir, 'papers');
const libraryFile = path.join(config.dataDir, 'library.json');

function ensureDirs() {
  fs.mkdirSync(papersRoot, { recursive: true });
  if (!fs.existsSync(libraryFile)) fs.writeFileSync(libraryFile, '[]', 'utf8');
}

function loadLibrary() {
  try { return JSON.parse(fs.readFileSync(libraryFile, 'utf8')); } catch (e) { return []; }
}
function saveLibrary(lib) {
  fs.writeFileSync(libraryFile, JSON.stringify(lib, null, 2), 'utf8');
}

function nextId() {
  let max = 0;
  if (fs.existsSync(papersRoot)) {
    for (const d of fs.readdirSync(papersRoot, { withFileTypes: true })) {
      if (d.isDirectory() && d.name.startsWith('paper_')) {
        const n = parseInt(d.name.slice(6), 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
  }
  return 'paper_' + String(max + 1).padStart(3, '0');
}

function paperDir(id) {
  const d = path.join(papersRoot, id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function exists(id) {
  return fs.existsSync(path.join(papersRoot, id));
}

function sanitizeFilename(name) {
  let s = String(name || '').trim();
  // 只过滤 Windows 非法字符与控制字符，保留 Unicode（含中文）
  s = s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  // 去掉结尾的点和空格（Windows 不允许）
  s = s.replace(/[. ]+$/, '');
  if (!s) return 'paper.pdf';
  // Windows 保留设备名（CON/PRN/AUX/NUL/COM1..9/LPT1..9）
  const base = s.split('.')[0].toUpperCase();
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base)) {
    s = '_' + s;
  }
  return s;
}

function savePdf(id, filename, buf) {
  const d = paperDir(id);
  const safe = sanitizeFilename(filename);
  const p = path.join(d, safe);
  fs.writeFileSync(p, buf);
  return p;
}
function writeJson(id, name, data) {
  const p = path.join(paperDir(id), name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  return p;
}
function writeText(id, name, text) {
  const p = path.join(paperDir(id), name);
  fs.writeFileSync(p, text, 'utf8');
  return p;
}
function readJson(id, name, def) {
  const p = path.join(paperDir(id), name);
  if (!fs.existsSync(p)) return def;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; }
}
function readText(id, name, def) {
  const p = path.join(paperDir(id), name);
  if (!fs.existsSync(p)) return def || '';
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return def || ''; }
}
function pdfPath(id) {
  const d = path.join(papersRoot, id);
  if (!fs.existsSync(d)) return null;
  for (const f of fs.readdirSync(d)) {
    if (f.toLowerCase().endsWith('.pdf')) return path.join(d, f);
  }
  return null;
}
function listFigures(id) {
  const fdir = path.join(paperDir(id), 'figures');
  if (!fs.existsSync(fdir)) return [];
  return fs.readdirSync(fdir).filter(f => fs.statSync(path.join(fdir, f)).isFile());
}

// ---- 索引（library.json）----
function upsertPaper(rec) {
  const lib = loadLibrary();
  const i = lib.findIndex(p => p.id === rec.id);
  if (i >= 0) {
    const prev = lib[i];
    lib[i] = Object.assign({}, prev, rec, { id: prev.id, createdAt: prev.createdAt || rec.createdAt });
  } else {
    lib.push(rec);
  }
  saveLibrary(lib);
}
function listPapers() {
  return loadLibrary().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
function getPaper(id) {
  return loadLibrary().find(p => p.id === id) || null;
}
function updatePaper(id, patch) {
  const lib = loadLibrary();
  const i = lib.findIndex(p => p.id === id);
  if (i >= 0) { Object.assign(lib[i], patch); saveLibrary(lib); }
}
function deletePaper(id) {
  const d = path.join(papersRoot, id);
  if (fs.existsSync(d)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
  const lib = loadLibrary();
  saveLibrary(lib.filter(p => p.id !== id));
}

module.exports = {
  ensureDirs, nextId, paperDir, exists, savePdf, sanitizeFilename, writeJson, writeText,
  readJson, readText, pdfPath, listFigures,
  upsertPaper, listPapers, getPaper, updatePaper, deletePaper,
};
