'use strict';
// 多篇论文对比：技术路线演化、优缺点、Research Gap。
const { getProvider } = require('./llm');
const store = require('./store');
const { extractJson, truncate } = require('./util');

function paperSummary(paperId) {
  const meta = store.readJson(paperId, 'metadata.json', {});
  const analysis = store.readJson(paperId, 'analysis.json', {});
  const sec = (analysis && analysis.sections) || {};
  return {
    paper_id: paperId,
    title: meta.title || analysis.title || paperId,
    year: meta.year || analysis.year || null,
    research_problem: sec.research_problem || '',
    proposed_method: sec.proposed_method || '',
    results: sec.results || '',
    contributions: sec.contributions || [],
    limitations: sec.limitations || [],
    research_gap: sec.research_gap || [],
  };
}

function buildComparisonPrompt(summaries) {
  const lines = [
    'Compare the following papers and return ONLY valid JSON (no fences) matching this schema:',
    '{ "method_evolution": "...", "strengths_weaknesses": {"<paper_id>": {"strengths": ["..."], "weaknesses": ["..."]}}, "research_gap": ["..."] }',
    '',
    'Requirements:',
    '- method_evolution: 2-5 sentences tracing how the technical route evolved across these papers.',
    '- strengths_weaknesses: per paper_id, 2-4 strengths and 2-4 weaknesses.',
    '- research_gap: 3-6 concrete open problems synthesized from the papers.',
    '',
    '=== PAPERS ===',
  ];
  for (const s of summaries) {
    lines.push(`\n[${s.paper_id}] ${s.title} (${s.year})`);
    lines.push(`  research_problem: ${truncate(s.research_problem, 500)}`);
    lines.push(`  proposed_method: ${truncate(s.proposed_method, 500)}`);
    lines.push(`  limitations: ${(s.limitations || []).join('; ').slice(0, 400)}`);
    lines.push(`  research_gap: ${(s.research_gap || []).join('; ').slice(0, 400)}`);
  }
  return lines.join('\n');
}

async function comparePapers(paperIds, opts) {
  opts = opts || {};
  const summaries = paperIds.map(paperSummary);
  const provider = getProvider(opts.provider, opts.model);
  const result = { provider: provider.name, papers: summaries, method_evolution: '', strengths_weaknesses: {}, research_gap: [] };

  if (provider.name !== 'heuristic' && provider.available()) {
    try {
      const resp = await provider.complete(
        'You are a senior research analyst comparing academic papers.',
        buildComparisonPrompt(summaries)
      );
      const parsed = extractJson(resp.text);
      if (parsed && typeof parsed === 'object') {
        result.method_evolution = parsed.method_evolution || '';
        result.strengths_weaknesses = parsed.strengths_weaknesses || {};
        result.research_gap = parsed.research_gap || [];
        result.provider = provider.name;
        result.model = resp.model || opts.model || '';
        return result;
      }
    } catch (e) { /* fall through */ }
  }

  result.provider = 'heuristic';
  result.method_evolution = summaries.map(s => `${s.title}（${s.year}）提出 ${truncate(s.proposed_method, 120) || 'N/A'}`).join(' → ');
  result.strengths_weaknesses = {};
  for (const s of summaries) {
    result.strengths_weaknesses[s.paper_id] = {
      strengths: s.contributions.length ? s.contributions : ['未识别'],
      weaknesses: s.limitations.length ? s.limitations : ['未识别'],
    };
  }
  const gaps = [];
  for (const s of summaries) { gaps.push(...(s.research_gap || []), ...(s.limitations || [])); }
  result.research_gap = [...new Set(gaps.filter(Boolean))].slice(0, 8);
  return result;
}

module.exports = { comparePapers };
