'use strict';
// 通用工具：JSON 提取、截断、分句、时间戳。

function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch (e) { /* continue */ }
  let s = t.indexOf('{'); let e = t.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch (e2) { /* continue */ } }
  s = t.indexOf('['); e = t.lastIndexOf(']');
  if (s !== -1 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch (e3) { /* continue */ } }
  return null;
}

function truncate(text, n) {
  const s = (text || '').trim();
  return s.length <= n ? s : s.slice(0, n) + '\n...[truncated]';
}

function splitSentences(text) {
  if (!text) return [];
  return String(text).split(/(?<=[.!?。！？])\s+/).map(s => s.trim()).filter(Boolean);
}

function now() {
  return new Date().toISOString();
}

module.exports = { extractJson, truncate, splitSentences, now };
