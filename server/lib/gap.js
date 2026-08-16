'use strict';
// Research Gap 发现：跨多篇论文汇总研究空白。
const { getProvider } = require('./llm');
const store = require('./store');
const { extractJson } = require('./util');

async function findGaps(paperIds, opts) {
  opts = opts || {};
  const items = paperIds.map(pid => {
    const meta = store.readJson(pid, 'metadata.json', {});
    const analysis = store.readJson(pid, 'analysis.json', {});
    const sec = (analysis && analysis.sections) || {};
    return {
      paper_id: pid,
      title: meta.title || analysis.title || pid,
      limitations: sec.limitations || [],
      research_gap: sec.research_gap || [],
      possible_extensions: sec.possible_extensions || [],
    };
  });

  const provider = getProvider(opts.provider, opts.model);
  const result = { provider: provider.name, papers: items, research_gaps: [], summary: '' };

  if (provider.name !== 'heuristic' && provider.available()) {
    const lines = [
      'Synthesize research gaps across these papers. Return ONLY valid JSON (no fences):',
      '{ "research_gaps": ["gap1", "gap2", ...], "summary": "..." }',
      '', '=== PAPERS ===',
    ];
    for (const it of items) {
      lines.push(`\n[${it.paper_id}] ${it.title}`);
      lines.push(`  limitations: ${it.limitations.join('; ').slice(0, 400)}`);
      lines.push(`  research_gap: ${it.research_gap.join('; ').slice(0, 400)}`);
      lines.push(`  possible_extensions: ${it.possible_extensions.join('; ').slice(0, 400)}`);
    }
    try {
      const resp = await provider.complete('You are a research strategist who identifies research gaps.', lines.join('\n'));
      const parsed = extractJson(resp.text);
      if (parsed && typeof parsed === 'object') {
        result.research_gaps = parsed.research_gaps || [];
        result.summary = parsed.summary || '';
        result.provider = provider.name;
        result.model = resp.model || opts.model || '';
        return result;
      }
    } catch (e) { /* fall through */ }
  }

  result.provider = 'heuristic';
  const gaps = [];
  for (const it of items) { gaps.push(...it.research_gap, ...it.limitations, ...it.possible_extensions); }
  result.research_gaps = [...new Set(gaps.filter(Boolean))].slice(0, 12);
  result.summary = `启发式汇总：从 ${items.length} 篇论文的 limitations / research_gap / possible_extensions 中去重得到 ${result.research_gaps.length} 条潜在研究空白。配置 LLM 后可获得语义层面的聚类与凝练。`;
  return result;
}

module.exports = { findGaps };
