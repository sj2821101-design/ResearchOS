'use strict';
// 论文分析器：LLM 深度分析 + 本地启发式回退。
const templates = require('./templates');
const { getProvider } = require('./llm');
const store = require('./store');
const { extractJson, splitSentences, truncate, now } = require('./util');

function ensureAnalysis(parsed, includeSatellite) {
  parsed = parsed && typeof parsed === 'object' ? parsed : {};
  const sec = parsed.sections && typeof parsed.sections === 'object' ? parsed.sections : {};

  const sections = {};
  for (const [key, , kind] of templates.GENERAL_SECTIONS) {
    const val = sec[key];
    if (kind === 'list') sections[key] = Array.isArray(val) ? val.map(String) : (val ? [String(val)] : []);
    else sections[key] = val ? String(val) : '';
  }

  const satellite = {};
  if (includeSatellite) {
    const sat = parsed.satellite && typeof parsed.satellite === 'object' ? parsed.satellite : {};
    for (const [key, , kind] of templates.SATELLITE_FIELDS) {
      const val = sat[key];
      if (kind === 'list') satellite[key] = Array.isArray(val) ? val.map(String) : (val ? [String(val)] : []);
      else if (kind === 'object') satellite[key] = (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};
      else satellite[key] = val ? String(val) : 'N/A (not covered in this paper)';
    }
  }

  return {
    schema_version: '1.0',
    overview_summary: String(parsed.overview_summary || ''),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
    sections,
    satellite,
  };
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function processEvidence(parsed, rawSections) {
  const normSections = {};
  for (const [k, v] of Object.entries(rawSections || {})) normSections[k] = normalize(v);

  const rawEvidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
  const evidence = rawEvidence.map((ev, i) => {
    const item = (ev && typeof ev === 'object') ? ev : {};
    const id = String(item.id || ('E' + (i + 1)));
    const section = String(item.section || '');
    const quote = String(item.quote || '');
    const type = String(item.type || 'paper_stated');
    const supports = Array.isArray(item.supports) ? item.supports.map(String) : [];
    let verified = false;
    if (quote && section && supports.length && normSections[section]) {
      verified = normSections[section].includes(normalize(quote));
    }
    return { id, section, quote, type, supports, verified };
  });

  const rawGap = Array.isArray(parsed.research_gap_details) ? parsed.research_gap_details : [];
  const research_gap_details = rawGap.map(g => {
    const gg = (g && typeof g === 'object') ? g : {};
    return {
      statement: String(gg.statement || ''),
      type: String(gg.type || 'derived'),
      evidence_ids: Array.isArray(gg.evidence_ids) ? gg.evidence_ids.map(String) : [],
    };
  }).filter(g => g.statement);

  return { evidence, research_gap_details };
}

function matchSentences(text, cues, limit) {
  const hits = splitSentences(text).filter(s => cues.some(c => s.toLowerCase().includes(c.toLowerCase())));
  return hits.slice(0, limit || 3).join(' ');
}

const SATELLITE_KEYWORDS = {
  satellite_architecture: ['satellite', 'leo', 'meo', 'geo', 'space', 'orbit', 'payload', 'transponder'],
  constellation_model: ['constellation', 'walker', 'inclination', 'orbital plane', 'altitude', 'satellites'],
  channel_model: ['channel', 'fading', 'rician', 'rayleigh', 'shadowing', 'path loss', 'free-space', 'doppler', 'snr'],
  access_model: ['access', 'random access', 'tdma', 'fdma', 'cdma', 'noma', 'grant-free', 'aloha', 'slotted'],
  resource_allocation: ['resource allocation', 'bandwidth', 'power allocation', 'beam', 'frequency', 'spectrum', 'scheduling'],
  optimization_objective: ['maximize', 'minimize', 'objective', 'optimization', 'energy efficiency', 'spectral efficiency', 'throughput'],
  algorithm_complexity: ['complexity', 'o(', 'convergence', 'iteration', 'computational'],
  simulation_parameters: ['simulation', 'parameters', 'altitude', 'bandwidth', 'frequency', 'transmit power'],
  baseline_algorithms: ['tdma', 'fdma', 'ofdma', 'noma', 'random access', 'round robin', 'greedy', 'genetic algorithm',
    'water-filling', 'dqn', 'ppo', 'a3c', 'maddpg', 'heuristic', 'exhaustive search', 'branch and bound'],
  performance_metrics: ['throughput', 'latency', 'energy', 'spectral efficiency', 'coverage', 'outage probability',
    'sum rate', 'delay', 'fairness', 'packet loss', 'reliability', 'qos'],
};

function heuristicSatellite(fullText) {
  const low = fullText.toLowerCase();
  const out = {};
  for (const [key, terms] of Object.entries(SATELLITE_KEYWORDS)) {
    if (key === 'baseline_algorithms') { out[key] = terms.filter(t => low.includes(t)); continue; }
    if (key === 'performance_metrics') { out[key] = terms.filter(t => low.includes(t)); continue; }
    if (key === 'simulation_parameters') { out[key] = {}; continue; }
    const hits = terms.filter(t => low.includes(t));
    out[key] = hits.length
      ? `(启发式) 检测到相关术语: ${[...new Set(hits)].join(', ').slice(0, 200)}. 配置 LLM 后可获得深度分析。`
      : 'N/A (not covered in this paper)';
  }
  return out;
}

function heuristicAnalysis(meta, sections, includeSatellite) {
  const intro = sections.introduction || '';
  const concl = sections.conclusion || '';
  const future = sections.future_work || '';
  const full = Object.values(sections).join('\n');

  const contribCues = ['contribution', 'novel', 'we propose', 'main contributions', 'this paper proposes'];
  const contributions = [];
  for (const cue of contribCues) {
    const m = matchSentences(intro + '\n' + concl, [cue], 2);
    contributions.push(...splitSentences(m));
  }
  const uniqContrib = [...new Set(contributions)].slice(0, 5);
  const contributionsFinal = uniqContrib.length ? uniqContrib : ['(启发式) 未识别出明确贡献条目'];

  const limRaw = matchSentences(concl + '\n' + future, ['limitation', 'future work', 'however', 'remains', 'can be improved', 'still'], 4);
  const limitations = splitSentences(limRaw).slice(0, 4);
  const limitationsFinal = limitations.length ? limitations : ['(启发式) 未识别出明确不足'];

  const researchGap = [...new Set([...limitations, ...splitSentences(future).slice(0, 2)])].slice(0, 5);
  const possibleExtensions = splitSentences(future).slice(0, 4).length ? splitSentences(future).slice(0, 4) : limitations.slice(0, 2);

  const parsed = {
    overview_summary: meta.abstract || '',
    keywords: meta.keywords || [],
    sections: {
      research_problem: splitSentences(meta.abstract || intro).slice(0, 3).join(' '),
      motivation: matchSentences(intro, ['motivat', 'important', 'challenge', 'however', 'limited', 'urgent', 'need', 'problem'], 3) || '(启发式) 见 Introduction',
      related_work: truncate(sections.related_work || '', 800) || 'N/A',
      system_model: truncate(sections.system_model || '', 800) || 'N/A',
      problem_formulation: truncate(sections.problem_formulation || sections.mathematical_formulation || '', 800) || 'N/A',
      proposed_method: truncate(sections.method || '', 1200) || 'N/A',
      mathematical_formulation: truncate(sections.mathematical_formulation || sections.method || '', 1200) || 'N/A',
      algorithm: truncate(sections.algorithm || sections.method || '', 800) || 'N/A',
      experiment_design: truncate(sections.experiments || '', 1200) || 'N/A',
      results: truncate(sections.experiments || '', 1200) || 'N/A',
      contributions: contributionsFinal,
      limitations: limitationsFinal,
      research_gap: researchGap,
      possible_extensions: possibleExtensions,
    },
    satellite: includeSatellite ? heuristicSatellite(full) : {},
  };
  return ensureAnalysis(parsed, includeSatellite);
}

async function analyzePaper(paperId, opts) {
  opts = opts || {};
  const includeSatellite = opts.includeSatellite !== false;
  const meta = store.readJson(paperId, 'metadata.json', {});
  const rawSections = store.readJson(paperId, 'sections.json', {});

  const provider = getProvider(opts.provider, opts.model);
  let analysis = null;
  let providerUsed = 'heuristic';
  let modelUsed = '';

  if (provider.name !== 'heuristic' && provider.available()) {
    try {
      const system = templates.buildAnalysisSystemPrompt(includeSatellite);
      const user = templates.buildAnalysisUserPrompt(meta, rawSections);
      const resp = await provider.complete(system, user);
      const parsed = extractJson(resp.text);
      if (parsed) {
        analysis = ensureAnalysis(parsed, includeSatellite);
        const ev = processEvidence(parsed, rawSections);
        analysis.evidence = ev.evidence;
        analysis.research_gap_details = ev.research_gap_details;
        if (ev.research_gap_details.length && (!analysis.sections.research_gap || !analysis.sections.research_gap.length)) {
          analysis.sections.research_gap = ev.research_gap_details.map(g => g.statement);
        }
        providerUsed = provider.name;
        modelUsed = resp.model || opts.model || '';
      }
    } catch (e) {
      analysis = null;
    }
  }

  if (!analysis) {
    analysis = heuristicAnalysis(meta, rawSections, includeSatellite);
    providerUsed = 'heuristic';
    modelUsed = '';
  }

  // 向后兼容：旧/启发式 analysis 没有 evidence 时，默认空数组而非报错
  if (!Array.isArray(analysis.evidence)) analysis.evidence = [];
  if (!Array.isArray(analysis.research_gap_details)) analysis.research_gap_details = [];

  analysis.paper_id = paperId;
  analysis.provider = providerUsed;
  analysis.model = modelUsed;
  analysis.generated_at = now();
  analysis.title = meta.title || '';
  analysis.authors = meta.authors || [];
  analysis.year = meta.year || null;
  analysis.venue = meta.venue || '';

  store.writeJson(paperId, 'analysis.json', analysis);
  store.updatePaper(paperId, { analysisStatus: 'analyzed', analysisProvider: providerUsed, analysisModel: modelUsed || null });
  return analysis;
}

module.exports = { analyzePaper, heuristicAnalysis, ensureAnalysis, processEvidence, normalize };
