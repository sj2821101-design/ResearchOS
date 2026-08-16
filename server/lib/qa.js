'use strict';
// 论文问答：论文库内简单检索 + LLM 生成（无 LLM 时返回相关原文句）。
// 检索无命中时（如中文提问英文论文），回退为"摘要+关键章节"上下文交给 LLM 自行理解。
const { getProvider } = require('./llm');
const store = require('./store');
const { splitSentences, truncate } = require('./util');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'of', 'in', 'on', 'to', 'for',
  'with', 'and', 'or', 'by', 'as', 'at', 'from', 'this', 'that', 'these', 'those', 'what',
  'which', 'how', 'why', 'does', 'do', 'did', 'whats', 'its', 'it', 'we', 'they', 'you',
  '论文', '的', '了', '是', '和', '与', '及', '在', '中', '对', '该', '如何', '什么', '哪些',
]);

function tokens(text) {
  const m = String(text).toLowerCase().match(/[A-Za-z0-9\u4e00-\u9fff]+/g) || [];
  return m.filter(t => !STOPWORDS.has(t));
}

function retrieve(paperIds, question, topK) {
  const qTokens = new Set(tokens(question));
  const scored = [];
  for (const pid of paperIds) {
    const meta = store.readJson(pid, 'metadata.json', {});
    const sections = store.readJson(pid, 'sections.json', {});
    for (const [sectionName, text] of Object.entries(sections)) {
      for (const sent of splitSentences(text)) {
        const st = new Set(tokens(sent));
        if (!st.size) continue;
        const overlap = [...qTokens].filter(t => st.has(t)).length
          + 0.5 * [...qTokens].filter(t => tokens(sectionName).includes(t)).length;
        if (overlap > 0) scored.push([overlap, pid, meta.title || pid, sectionName, sent]);
      }
    }
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, topK || 6).map(([, pid, title, section, text]) => ({
    paper_id: pid, title, section, text: truncate(text, 800),
  }));
}

// 检索无命中时的兜底上下文：每篇论文取摘要 + 关键章节，总量截断
function buildFallbackContext(paperIds) {
  const order = ['introduction', 'conclusion', 'method', 'system_model',
    'problem_formulation', 'related_work', 'experiments', 'algorithm'];
  const parts = [];
  for (const pid of paperIds) {
    const meta = store.readJson(pid, 'metadata.json', {});
    const sections = store.readJson(pid, 'sections.json', {});
    let body = `[${pid} | ${meta.title || pid}]\n`;
    if (meta.abstract) body += `摘要：${truncate(meta.abstract, 1500)}\n`;
    let budget = 7000;
    for (const key of order) {
      const text = sections[key];
      if (!text || budget <= 0) continue;
      const chunk = truncate(text, Math.min(budget, 2000));
      body += `【${key}】${chunk}\n`;
      budget -= chunk.length;
    }
    parts.push(body);
  }
  return parts.join('\n\n');
}

async function answerQuestion(paperIds, question, opts) {
  opts = opts || {};
  const hits = retrieve(paperIds, question);
  const provider = getProvider(opts.provider, opts.model);
  const result = { provider: provider.name, question, answer: '', sources: hits };

  if (provider.name !== 'heuristic' && provider.available()) {
    let ctx = '';
    if (hits.length) {
      ctx = hits.map(h => `[${h.paper_id} | ${h.title} | ${h.section}]\n${h.text}`).join('\n\n');
    } else {
      ctx = buildFallbackContext(paperIds);
    }
    if (ctx) {
      const system = '你是科研论文助手。请根据提供的论文内容回答用户问题，用简体中文回答，并尽量标注引用的论文 id。若内容不足以回答，请如实说明。';
      try {
        const resp = await provider.complete(system, `问题：${question}\n\n论文内容：\n${ctx}`);
        result.answer = resp.text;
        result.provider = provider.name;
        result.model = resp.model || opts.model || '';
        return result;
      } catch (e) { /* fall through */ }
    }
  }

  result.provider = 'heuristic';
  result.answer = hits.length
    ? hits.map(h => `【${h.paper_id} · ${h.section}】 ${h.text}`).join('\n\n')
    : '在所选论文中未检索到与问题相关的段落，且当前未配置 LLM。请尝试更具体的关键词，或配置 DeepSeek Key。';
  return result;
}

module.exports = { answerQuestion, retrieve, buildFallbackContext };
