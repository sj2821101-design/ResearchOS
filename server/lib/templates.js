'use strict';
// 论文分析模板（16 段 + 天基物联网 10 字段）与 Prompt 构造。

// (key, 标题, 类型) —— type: text | list
const GENERAL_SECTIONS = [
  ['research_problem', '02 Research Problem', 'text'],
  ['motivation', '03 Motivation', 'text'],
  ['related_work', '04 Related Work', 'text'],
  ['system_model', '05 System Model', 'text'],
  ['problem_formulation', '06 Problem Formulation', 'text'],
  ['proposed_method', '07 Proposed Method', 'text'],
  ['mathematical_formulation', '08 Mathematical Formulation', 'text'],
  ['algorithm', '09 Algorithm', 'text'],
  ['experiment_design', '10 Experiment Design', 'text'],
  ['results', '11 Results', 'text'],
  ['contributions', '12 Contributions', 'list'],
  ['limitations', '13 Limitations', 'list'],
  ['research_gap', '14 Research Gap', 'list'],
  ['possible_extensions', '15 Possible Extensions', 'list'],
];

const SATELLITE_FIELDS = [
  ['satellite_architecture', 'Satellite Architecture', 'text'],
  ['constellation_model', 'Constellation Model', 'text'],
  ['channel_model', 'Channel Model', 'text'],
  ['access_model', 'Access Model', 'text'],
  ['resource_allocation', 'Resource Allocation', 'text'],
  ['optimization_objective', 'Optimization Objective', 'text'],
  ['algorithm_complexity', 'Algorithm Complexity', 'text'],
  ['simulation_parameters', 'Simulation Parameters', 'object'],
  ['baseline_algorithms', 'Baseline Algorithms', 'list'],
  ['performance_metrics', 'Performance Metrics', 'list'],
];

function budget(text, n) {
  const s = (text || '').trim();
  return s.length <= n ? s : s.slice(0, n) + '\n...[truncated]';
}

function buildAnalysisSystemPrompt(includeSatellite) {
  let satelliteBlock = '';
  if (includeSatellite) {
    const lines = SATELLITE_FIELDS.map(([key, , t]) => {
      const val = t === 'text' ? '"..."' : (t === 'list' ? '["..."]' : '{...}');
      return `    "${key}": ${val},`;
    });
    satelliteBlock = `\n  "satellite": {\n${lines.join('\n')}\n  },`;
  }
  return `You are a senior research analyst specializing in satellite IoT / space-terrestrial integrated networks.
Read the provided academic paper (title, abstract, keywords, and sections) and produce a STRUCTURED JSON analysis.

Return ONLY a valid JSON object — no markdown fences, no commentary, no extra text — matching this exact schema:
{
  "keywords": ["...", "..."],
  "sections": {
    "research_problem": "...",
    "motivation": "...",
    "related_work": "...",
    "system_model": "...",
    "problem_formulation": "...",
    "proposed_method": "...",
    "mathematical_formulation": "...",
    "algorithm": "...",
    "experiment_design": "...",
    "results": "...",
    "contributions": ["...", "..."],
    "limitations": ["...", "..."],
    "research_gap": ["...", "..."],
    "possible_extensions": ["...", "..."]
  },${satelliteBlock}
  "overview_summary": "...",
  "evidence": [
    { "id": "E1", "section": "introduction", "quote": "verbatim sentence copied from that section", "type": "paper_stated", "supports": ["research_problem", "motivation"] }
  ],
  "research_gap_details": [
    { "statement": "...", "type": "paper_stated", "evidence_ids": ["E1"] }
  ]
}

Rules:
- Write all analysis content in Simplified Chinese (简体中文). Keep evidence[].quote VERBATIM in the paper's original language — never translate quotes.
- Text fields: 1-4 informative sentences each, grounded in the paper. Do NOT invent content that is absent.
- List fields (contributions / limitations / research_gap / possible_extensions / baseline_algorithms / performance_metrics): 2-6 short, specific items.
- If the paper does not cover a satellite-specific field, set it to "N/A (not covered in this paper)" for text fields, or [] for list fields.
- simulation_parameters is an object of parameter-name -> value.
- overview_summary: a 2-3 sentence abstract-level summary of the whole paper.
- If a section is genuinely absent from the paper, write a one-line honest note ("Not explicitly discussed") rather than fabricating.

EVIDENCE rules (important):
- evidence is a list of the strongest claims, each backed by an EXACT verbatim quote from the paper.
- evidence[].quote MUST be copied word-for-word (verbatim) from the provided section text. Never paraphrase or invent a quote.
- evidence[].section is the raw section name the quote comes from (e.g. "introduction", "method", "experiments", "conclusion").
- evidence[].supports lists the analysis field(s) this quote supports (research_problem / motivation / related_work / system_model / problem_formulation / proposed_method / mathematical_formulation / algorithm / experiment_design / results / contributions / limitations / research_gap / possible_extensions).
- evidence[].type must be one of:
  - "paper_stated"  : the paper's authors explicitly state this.
  - "derived"       : reasonably inferred from the paper, but the authors did not state it in these exact words.
  - "speculative"   : your own hypothesis / potential research direction beyond what the paper states.
- Provide 6-15 evidence items in total, prioritizing: research_problem, motivation, proposed_method, algorithm, experiment_design, results, contributions, limitations, research_gap.
- If the paper does not explicitly state something, do NOT label it paper_stated.

RESEARCH GAP rules:
- Keep "research_gap" (in sections) as a short string array (for backward compatibility).
- Also provide "research_gap_details": for each gap, a statement, a type (paper_stated / derived / speculative), and evidence_ids referencing the evidence list (can be empty []).`;
}

function buildAnalysisUserPrompt(meta, sections, charBudget) {
  charBudget = charBudget || 24000;
  const lines = [];
  lines.push('=== PAPER METADATA ===');
  lines.push(`Title: ${meta.title || 'N/A'}`);
  lines.push(`Authors: ${(meta.authors || []).join(', ') || 'N/A'}`);
  lines.push(`Year: ${meta.year || 'N/A'}   Venue: ${meta.venue || 'N/A'}`);
  lines.push(`Keywords: ${(meta.keywords || []).join(', ') || 'N/A'}`);
  lines.push('');
  lines.push(`Abstract:\n${budget(meta.abstract || '', 2500)}`);
  lines.push('');
  lines.push('=== PAPER RAW SECTIONS (truncated) ===');
  lines.push("Below is the paper's raw section text. Based on these raw sections, derive the high-level analysis fields yourself: research_problem, motivation, related_work, system_model, problem_formulation, proposed_method, mathematical_formulation, algorithm, experiment_design, results, contributions, limitations, research_gap, possible_extensions. Do NOT treat the raw section headings as the output JSON keys.");
  let used = 0;
  for (const [sectionName, text] of Object.entries(sections || {})) {
    const raw = (text || '').trim();
    if (!raw) continue;
    const room = charBudget - used;
    if (room <= 0) break;
    const chunk = budget(raw, Math.min(room, 4000));
    lines.push(`\n## ${sectionName}\n${chunk}`);
    used += chunk.length;
  }
  lines.push('');
  lines.push('=== NOTE ===');
  lines.push('Pay special attention to any satellite/constellation/channel/access/resource-allocation content for the satellite-specific fields.');
  return lines.join('\n');
}

module.exports = { GENERAL_SECTIONS, SATELLITE_FIELDS, buildAnalysisSystemPrompt, buildAnalysisUserPrompt };
