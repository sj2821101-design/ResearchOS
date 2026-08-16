'use strict';
// 零依赖 PDF 文本抽取器（Phase 1）。
// 支持：FlateDecode 流解压（zlib）+ 文本运算符 Tj / TJ / ' / " 解析。
// 限制：扫描版 PDF（无文本层）、复杂 CID 字体映射、ToUnicode 表暂不处理；
//       图片/公式/表格的精细抽取留给后续接入 Marker/GROBID/Docling。
const zlib = require('zlib');

function isPdf(buf) {
  return buf.length >= 5 && buf.toString('latin1', 0, 5) === '%PDF-';
}

function extractPdf(buf) {
  if (!isPdf(buf)) {
    const text = buf.toString('utf8');
    return { pages: [{ page: 1, text }], text, numPages: 1, pdfMeta: {}, numFigures: 0, source: 'text' };
  }
  const src = buf.toString('latin1');
  const meta = parseInfo(src);
  const streams = extractContentStreams(src);
  const texts = streams.map(extractTextFromContent).filter(t => t && t.trim());
  const text = texts.join('\n\n');
  return { pages: texts.map((t, i) => ({ page: i + 1, text: t })), text, numPages: texts.length || 1, pdfMeta: meta, numFigures: 0, source: 'pdf' };
}

function parseInfo(src) {
  const meta = {};
  for (const key of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate']) {
    const re = new RegExp('/' + key + '\\s*\\((.*?)\\)', '');
    const m = src.match(re);
    if (m) meta[key] = decodePdfString(m[1]);
  }
  return meta;
}

function decodePdfString(s) {
  return s.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\([()\\])/g, '$1');
}

function extractContentStreams(src) {
  const streams = [];
  let idx = 0;
  while (true) {
    let sIdx = src.indexOf('stream', idx);
    if (sIdx === -1) break;
    // 跳过 endstream 里包含的 'stream'
    if (sIdx >= 3 && src.slice(sIdx - 3, sIdx) === 'end') { idx = sIdx + 6; continue; }

    const dictEnd = src.lastIndexOf('>>', sIdx);
    const dictStart = dictEnd >= 0 ? src.lastIndexOf('<<', dictEnd) : -1;
    const dict = dictStart >= 0 ? src.slice(dictStart, dictEnd + 2) : '';

    let dataStart = sIdx + 'stream'.length;
    if (src[dataStart] === '\r' && src[dataStart + 1] === '\n') dataStart += 2;
    else if (src[dataStart] === '\n') dataStart += 1;
    else if (src[dataStart] === '\r') dataStart += 1;

    if (dataStart >= src.length) break;

    let raw;
    const lm = dict.match(/\/Length\s+(\d+)/);
    if (lm) {
      raw = src.slice(dataStart, dataStart + parseInt(lm[1], 10));
    } else {
      const eIdx = src.indexOf('endstream', dataStart);
      if (eIdx === -1) break;
      raw = src.slice(dataStart, eIdx);
    }

    const filtered = /\/Filter\s*\/FlateDecode/.test(dict);
    let decoded = raw;
    if (filtered) {
      const b = Buffer.from(raw, 'latin1');
      try { decoded = zlib.inflateSync(b).toString('latin1'); }
      catch (e1) { try { decoded = zlib.inflateRawSync(b).toString('latin1'); } catch (e2) { decoded = raw; } }
    }
    streams.push(decoded);
    idx = sIdx + 1;
  }
  return streams;
}

function extractTextFromContent(cs) {
  const out = [];
  let i = 0;
  let pending = '';
  while (i < cs.length) {
    const ch = cs[i];
    if (ch === '(') {
      const r = readLiteralString(cs, i); pending = r.value; i = r.next;
    } else if (ch === '<' && cs[i + 1] !== '<') {
      const r = readHexString(cs, i); pending = r.value; i = r.next;
    } else if (ch === '[') {
      const r = readArray(cs, i);
      let line = '';
      for (const it of r.items) {
        if (it.type === 's') line += it.value;
        else if (it.type === 'n' && it.value < -100) line += ' ';
      }
      if (line.trim()) out.push(line.trim());
      i = r.next; pending = '';
    } else if (ch === 'T') {
      const nx = cs[i + 1];
      if (nx === 'j') { if (pending.trim()) out.push(pending.trim()); i += 2; pending = ''; continue; }
      if (nx === "'") { if (pending.trim()) out.push(pending.trim()); out.push('\n'); i += 2; pending = ''; continue; }
      if (nx === '"') { if (pending.trim()) out.push(pending.trim()); out.push('\n'); i += 2; pending = ''; continue; }
      if (nx === 'd' || nx === 'D') { out.push('\n'); i += 2; continue; }
      if (nx === '*') { out.push('\n'); i += 2; continue; }
      i++;
    } else {
      i++;
    }
  }
  return out.filter(Boolean).join(' ').replace(/[ \t]+/g, ' ');
}

function readLiteralString(s, start) {
  let i = start + 1, out = '', depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const nx = s[i + 1];
      if (nx === 'n') { out += '\n'; i += 2; }
      else if (nx === 'r') { out += '\r'; i += 2; }
      else if (nx === 't') { out += '\t'; i += 2; }
      else if (nx === 'b') { out += '\b'; i += 2; }
      else if (nx === 'f') { out += '\f'; i += 2; }
      else if (nx === '(' || nx === ')' || nx === '\\') { out += nx; i += 2; }
      else if (/[0-7]/.test(nx)) {
        let oct = ''; let j = 0;
        while (j < 3 && /[0-7]/.test(s[i + 1])) { oct += s[i + 1]; i++; j++; }
        out += String.fromCharCode(parseInt(oct, 8)); i++;
      } else { out += nx; i += 2; }
    } else if (c === '(') { depth++; out += c; i++; }
    else if (c === ')') { if (depth === 0) return { value: out, next: i + 1 }; depth--; out += c; i++; }
    else { out += c; i++; }
  }
  return { value: out, next: i };
}

function readHexString(s, start) {
  let i = start + 1, hex = '';
  while (i < s.length && s[i] !== '>') { if (/[0-9a-fA-F]/.test(s[i])) hex += s[i]; i++; }
  let out = '';
  for (let k = 0; k + 1 < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
  if (hex.length % 2 === 1) out += String.fromCharCode(parseInt(hex.slice(-1) + '0', 16));
  return { value: out, next: i + 1 };
}

function readArray(s, start) {
  let i = start + 1; const items = [];
  while (i < s.length) {
    const c = s[i];
    if (c === ']') { i++; break; }
    if (c === '(') { const r = readLiteralString(s, i); items.push({ type: 's', value: r.value }); i = r.next; }
    else if (c === '<') { const r = readHexString(s, i); items.push({ type: 's', value: r.value }); i = r.next; }
    else if (/[0-9+\-.]/.test(c)) { let j = i; while (j < s.length && /[0-9+\-.eE]/.test(s[j])) j++; items.push({ type: 'n', value: parseFloat(s.slice(i, j)) }); i = j; }
    else i++;
  }
  return { items, next: i };
}

module.exports = { extractPdf, isPdf };
