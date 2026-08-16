'use strict';
// HTTP 层冒烟测试：进程内启动服务器，用 fetch 打本机回环验证全部端点。
const fs = require('fs');
const path = require('path');
const config = require('../server/lib/config');
const { server } = require('../server/server');

(async () => {
  await new Promise(r => setTimeout(r, 300));
  const base = `http://127.0.0.1:${config.port}`;
  const j = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });

  const health = await j(await fetch(base + '/api/health'));
  console.log('health:', health.status, JSON.stringify(health.body));

  const pdfBuf = fs.readFileSync(path.join(__dirname, '..', 'sample', 'sample_satellite_iot.pdf'));

  const up1 = await j(await fetch(base + '/api/papers', {
    method: 'POST', headers: { 'X-Filename': 'sample_satellite_iot.pdf', 'Content-Type': 'application/pdf' }, body: pdfBuf,
  }));
  console.log('upload1:', up1.status, 'id=', up1.body && up1.body.id, 'sections=', up1.body && up1.body.num_sections);

  const up2 = await j(await fetch(base + '/api/papers', {
    method: 'POST', headers: { 'X-Filename': 'sample2.pdf', 'Content-Type': 'application/pdf' }, body: pdfBuf,
  }));
  const pid2 = up2.body && up2.body.id;
  console.log('upload2:', up2.status, 'id=', pid2);

  const list = await j(await fetch(base + '/api/papers'));
  console.log('list:', list.status, 'count=', Array.isArray(list.body) ? list.body.length : 'n/a');

  const pid = up1.body.id;
  const an = await j(await fetch(base + '/api/papers/' + pid + '/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ include_satellite: true }),
  }));
  console.log('analyze:', an.status, 'provider=', an.body && an.body.provider, 'overview=', (an.body && an.body.overview_summary || '').slice(0, 70));

  const det = await j(await fetch(base + '/api/papers/' + pid));
  console.log('detail:', det.status, 'sections=', det.body ? Object.keys(det.body.sections).length : 0, 'has_analysis=', !!(det.body && det.body.analysis));

  const put = await j(await fetch(base + '/api/papers/' + pid + '/notes', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: '我的研究笔记：重点关注资源分配与接入控制耦合。' }),
  }));
  const getNotes = await j(await fetch(base + '/api/papers/' + pid + '/notes'));
  console.log('notes put/get:', put.status, getNotes.body && getNotes.body.notes);

  const cmp = await j(await fetch(base + '/api/compare', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_ids: [pid, pid2] }),
  }));
  console.log('compare:', cmp.status, 'provider=', cmp.body && cmp.body.provider, 'papers=', cmp.body && cmp.body.papers && cmp.body.papers.length);

  const gaps = await j(await fetch(base + '/api/gaps', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_ids: [pid, pid2] }),
  }));
  console.log('gaps:', gaps.status, 'count=', gaps.body && gaps.body.research_gaps && gaps.body.research_gaps.length);

  const q = await j(await fetch(base + '/api/qa', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_ids: [pid], question: 'What method is proposed?' }),
  }));
  console.log('qa:', q.status, 'answer_len=', q.body && q.body.answer && q.body.answer.length);

  const idx = await fetch(base + '/');
  const html = await idx.text();
  console.log('index.html:', idx.status, 'contains ResearchOS:', html.includes('ResearchOS'));
  const css = await fetch(base + '/static/styles.css');
  console.log('styles.css:', css.status);

  console.log('HTTP SMOKE DONE');
  server.close();
  process.exit(0);
})().catch(e => { console.error('HTTP SMOKE ERROR:', e && e.stack || e); try { server.close(); } catch (_) {} process.exit(1); });
