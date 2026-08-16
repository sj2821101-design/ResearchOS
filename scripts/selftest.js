'use strict';
// 端到端自测：生成样例 PDF -> 解析 -> 结构化 -> 启发式分析 -> 对比/Gap/问答。
const fs = require('fs');
const path = require('path');
const pdf = require('../server/lib/pdf');
const structure = require('../server/lib/structure');
const analyzer = require('../server/lib/analyzer');
const comparer = require('../server/lib/comparer');
const gap = require('../server/lib/gap');
const qa = require('../server/lib/qa');
const store = require('../server/lib/store');

(async () => {
  store.ensureDirs();
  const sampleFile = path.join(__dirname, '..', 'sample', 'sample_satellite_iot.pdf');
  const buf = fs.readFileSync(sampleFile);
  console.log('PDF bytes:', buf.length, 'isPdf:', pdf.isPdf(buf));

  const parsed = pdf.extractPdf(buf);
  console.log('source:', parsed.source, 'numPages:', parsed.numPages, 'textLength:', parsed.text.length);
  console.log('--- extracted text (first 1200 chars) ---');
  console.log(parsed.text.slice(0, 1200));

  const meta = structure.extractMetadata(parsed.text, parsed.pdfMeta || {});
  console.log('\n--- metadata ---');
  console.log(JSON.stringify(meta, null, 2));

  const sections = structure.detectSections(parsed.text);
  console.log('\n--- sections detected:', Object.keys(sections).join(', '));

  const id = store.nextId();
  store.savePdf(id, 'sample.pdf', buf);
  store.writeJson(id, 'metadata.json', meta);
  store.writeJson(id, 'sections.json', sections);
  store.writeText(id, 'extracted_text.md', parsed.text);
  store.writeText(id, 'notes.md', '');

  const a = await analyzer.analyzePaper(id, { includeSatellite: true });
  console.log('\n--- analysis provider:', a.provider, '---');
  console.log('overview_summary:', (a.overview_summary || '').slice(0, 180));
  console.log('contributions:', JSON.stringify(a.sections.contributions));
  console.log('limitations:', JSON.stringify(a.sections.limitations));
  console.log('research_gap:', JSON.stringify(a.sections.research_gap));
  console.log('baseline_algorithms:', JSON.stringify(a.satellite.baseline_algorithms));
  console.log('performance_metrics:', JSON.stringify(a.satellite.performance_metrics));
  console.log('constellation_model:', a.satellite.constellation_model);
  console.log('simulation_parameters:', JSON.stringify(a.satellite.simulation_parameters));

  const cmp = await comparer.comparePapers([id], {});
  console.log('\n--- compare (single paper, heuristic) method_evolution ---');
  console.log((cmp.method_evolution || '').slice(0, 300));

  const g = await gap.findGaps([id], {});
  console.log('\n--- gaps ---');
  console.log('count:', g.research_gaps.length, 'first:', JSON.stringify(g.research_gaps.slice(0, 3)));

  const q = await qa.answerQuestion([id], 'What resource allocation method is proposed?', {});
  console.log('\n--- qa ---');
  console.log('answer:', (q.answer || '').slice(0, 400));
  console.log('\nDONE');
})().catch(e => { console.error('SELFTEST ERROR:', e && e.stack || e); process.exit(1); });
