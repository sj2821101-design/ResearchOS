'use strict';
/* ResearchOS V1 前端 SPA（零依赖原生 JS） */

const GENERAL_SECTIONS = [
  ['research_problem', '02 研究问题', 'text'],
  ['motivation', '03 研究动机', 'text'],
  ['related_work', '04 相关工作', 'text'],
  ['system_model', '05 系统模型', 'text'],
  ['problem_formulation', '06 问题建模', 'text'],
  ['proposed_method', '07 提出方法', 'text'],
  ['mathematical_formulation', '08 数学建模', 'text'],
  ['algorithm', '09 算法', 'text'],
  ['experiment_design', '10 实验设计', 'text'],
  ['results', '11 实验结果', 'text'],
  ['contributions', '12 贡献与创新', 'list'],
  ['limitations', '13 局限性', 'list'],
  ['research_gap', '14 研究空白', 'list'],
  ['possible_extensions', '15 可扩展方向', 'list'],
];

const SATELLITE_FIELDS = [
  ['satellite_architecture', '卫星架构', 'text'],
  ['constellation_model', '星座模型', 'text'],
  ['channel_model', '信道模型', 'text'],
  ['access_model', '接入模型', 'text'],
  ['resource_allocation', '资源分配', 'text'],
  ['optimization_objective', '优化目标', 'text'],
  ['algorithm_complexity', '算法复杂度', 'text'],
  ['simulation_parameters', '仿真参数', 'object'],
  ['baseline_algorithms', '基线算法', 'list'],
  ['performance_metrics', '性能指标', 'list'],
];

const state = {
  papers: [],
  selectedId: null,
  tab: 'detail',
  selection: new Set(),
  detailCache: {},
};

const $ = (sel) => document.querySelector(sel);
const view = $('#view');

/* ---------- 基础工具 ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { t.className = 'toast'; }, 2600);
}

async function api(path, opts) {
  const res = await fetch('/api' + path, opts);
  let body = null;
  try { body = await res.json(); } catch (e) { /* ignore */ }
  if (!res.ok) {
    const detail = body && body.detail ? body.detail : res.statusText;
    throw new Error(detail);
  }
  return body;
}

/* ---------- 列表 ---------- */
async function loadPapers() {
  try {
    state.papers = await api('/papers');
    renderList();
  } catch (e) { toast('加载论文列表失败: ' + e.message, true); }
}

function renderList() {
  const q = ($('#searchBox').value || '').toLowerCase();
  const list = state.papers.filter(p => {
    if (!q) return true;
    const hay = [p.title, p.filename, (p.authors || []).join(' '), (p.keywords || []).join(' ')].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const ul = $('#paperList');
  ul.innerHTML = list.map(p => {
    const status = p.analysisStatus || 'none';
    const stLabel = { none: '未分析', parsed: '已解析', analyzed: '已分析' }[status] || status;
    const checked = state.selection.has(p.id) ? 'checked' : '';
    const active = state.selectedId === p.id ? 'active' : '';
    const title = p.title || p.filename || p.id;
    return `<li class="paper-item ${active}" data-id="${esc(p.id)}">
      <input type="checkbox" class="sel" data-id="${esc(p.id)}" ${checked}>
      <div class="pi-body">
        <div class="pi-title">${esc(title)}</div>
        <div class="pi-meta">${p.year || '—'} · ${esc((p.authors || []).slice(0, 2).join(', ') || '—')}
          <span class="badge ${status}">${stLabel}</span></div>
      </div>
      <button class="del-btn" data-del="${esc(p.id)}" title="删除这篇论文">✕</button>
    </li>`;
  }).join('') || '<li class="skeleton">暂无论文，请先上传 PDF</li>';
  updateSelCount();
}

function updateSelCount() {
  $('#selCount').textContent = `已选 ${state.selection.size} 篇`;
}

/* ---------- 详情 ---------- */
async function selectPaper(id) {
  state.selectedId = id;
  renderList();
  view.innerHTML = '<div class="placeholder"><div class="big">⏳</div>加载中…</div>';
  try {
    const d = await api('/papers/' + encodeURIComponent(id));
    state.detailCache[id] = d;
    renderDetail(id, d);
  } catch (e) { view.innerHTML = `<div class="placeholder">加载失败：${esc(e.message)}</div>`; }
}

function renderDetail(id, d) {
  const meta = d.metadata || {};
  const analysis = d.analysis;
  const providerTag = analysis
    ? (analysis.provider === 'heuristic'
      ? '<span class="provider-tag heuristic">本地启发式分析</span>'
      : `<span class="provider-tag llm">${esc(analysis.provider)}${analysis.model ? ' · ' + esc(analysis.model) : ''}</span>`)
    : '<span class="provider-tag heuristic" style="background:#e5e7eb;color:#6b7280">尚未分析</span>';

  const chips = (meta.keywords || []).map(k => `<span class="chip">${esc(k)}</span>`).join('');

  let sectionsHtml = '';
  if (analysis) {
    // 01 Overview
    sectionsHtml += sectionCard('01 论文概览', [
      (analysis.overview_summary || meta.abstract || '') + '',
    ]);
    // 02-15
    const sec = analysis.sections || {};
    const evidence = analysis.evidence || [];
    const evidenceByField = {};
    const evidenceById = {};
    for (const ev of evidence) {
      if (ev.verified === false) continue;
      if (ev.id) evidenceById[ev.id] = ev;
      for (const f of (ev.supports || [])) (evidenceByField[f] = evidenceByField[f] || []).push(ev);
    }
    const gapDetails = Array.isArray(analysis.research_gap_details) ? analysis.research_gap_details : [];
    for (const [key, title, kind] of GENERAL_SECTIONS) {
      if (key === 'research_gap' && gapDetails.length) {
        sectionsHtml += renderGapSection(gapDetails, evidenceById);
      } else {
        sectionsHtml += renderSection(key, title, kind, sec[key], false, evidenceByField[key] || []);
      }
    }
    // satellite
    const sat = analysis.satellite || {};
    let satHtml = '';
    for (const [key, title, kind] of SATELLITE_FIELDS) {
      satHtml += renderSection(key, title, kind, sat[key], true);
    }
    sectionsHtml += `<div class="card"><h2>🛰 天基物联网字段</h2><div class="grid2">${satHtml}</div></div>`;
  } else {
    sectionsHtml = `<div class="card"><p class="empty">尚未生成结构化分析。点击右上角「分析论文」按钮（无需 API Key 也能用本地启发式分析）。</p></div>`;
  }

  const rawSections = d.sections || {};
  const RAW_SECTION_LABEL = {
    abstract: '摘要', keywords: '关键词', introduction: '引言', related_work: '相关工作',
    system_model: '系统模型', problem_formulation: '问题建模', method: '方法',
    mathematical_formulation: '数学建模', algorithm: '算法', experiments: '实验',
    conclusion: '结论', discussion: '讨论', future_work: '未来工作', references: '参考文献',
  };
  const rawHtml = Object.entries(rawSections).map(([k, v]) =>
    `<details class="raw"><summary>${esc(RAW_SECTION_LABEL[k] || k)}</summary><pre>${esc(v)}</pre></details>`
  ).join('');

  const figures = d.figures || [];
  const figHtml = figures.length
    ? `<div class="fig-grid">${figures.map(f => `<img src="/api/papers/${esc(id)}/figures/${esc(f)}" alt="${esc(f)}">`).join('')}</div>`
    : '<p class="empty">（本阶段未抽取图片）</p>';

  view.innerHTML = `
    <div class="card">
      <div class="row">
        <h2 class="paper-title">${esc(meta.title || d.id)}</h2>
        <div class="spacer"></div>
        <button id="analyzeBtn" class="btn" data-id="${esc(id)}">分析论文</button>
      </div>
      <p class="authors">${esc((meta.authors || []).join(', ') || '作者未知')}</p>
      <p class="meta-line">
        ${meta.year || '—'}${meta.venue ? ' · ' + esc(meta.venue) : ''}${meta.doi ? ' · DOI: ' + esc(meta.doi) : ''}
        ${providerTag}
      </p>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
    </div>

    ${sectionsHtml}

    <div class="card">
      <h2>📝 16 我的研究笔记</h2>
      <textarea id="notesArea" class="notes-area" placeholder="在这里记录你的想法、疑问、与其它论文的关联…">${esc(d.notes || '')}</textarea>
      <div class="row" style="margin-top:10px"><button id="saveNotesBtn" class="btn ghost" data-id="${esc(id)}">保存笔记</button></div>
    </div>

    <div class="card">
      <h2>📄 原始章节文本</h2>
      ${rawHtml || '<p class="empty">未识别到章节</p>'}
    </div>

    <div class="card">
      <h2>🖼 图片</h2>
      ${figHtml}
    </div>
  `;
}

function renderSection(key, title, kind, val, isSatellite, evidences) {
  let body;
  if (kind === 'list') {
    const arr = Array.isArray(val) ? val : (val ? [val] : []);
    body = arr.length ? '<ul>' + arr.map(v => '<li>' + nl2br(v) + '</li>').join('') + '</ul>' : '<p class="empty">—</p>';
  } else if (kind === 'object') {
    const obj = val && typeof val === 'object' ? val : {};
    const rows = Object.entries(obj).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
    body = rows ? `<table class="kv"><tr><th>参数</th><th>值</th></tr>${rows}</table>` : '<p class="empty">—</p>';
  } else {
    const s = (val || '').toString().trim();
    body = s ? '<p>' + nl2br(s) + '</p>' : '<p class="empty">—</p>';
  }
  const evHtml = renderEvidenceBlock(evidences);
  const tag = isSatellite ? '<span class="badge none" style="background:#eef2ff;color:#4338ca">天基</span>' : '';
  return `<div class="sec"><div class="sec-head">${esc(title)} ${tag}</div><div class="sec-body">${body}${evHtml}</div></div>`;
}

function sectionCard(title, paragraphs) {
  return `<div class="card"><h2>${esc(title)}</h2>${paragraphs.map(p => '<p style="line-height:1.7">' + nl2br(p) + '</p>').join('')}</div>`;
}

const EVIDENCE_TYPE_LABEL = { paper_stated: '论文明确表述', derived: '推导', speculative: '推测' };

function evidenceTypeBadge(type) {
  return `<span class="ev-type ${esc(type)}">${esc(EVIDENCE_TYPE_LABEL[type] || type)}</span>`;
}

function renderEvidenceBlock(evidences) {
  if (!evidences || !evidences.length) return '';
  const items = evidences.map(ev => `
    <div class="evidence">
      <div class="ev-quote">“${esc(ev.quote)}”</div>
      <div class="ev-meta">${evidenceTypeBadge(ev.type)}<span class="ev-src">[${esc(ev.section)}]</span><span class="ev-id">${esc(ev.id)}</span></div>
    </div>`).join('');
  return `<div class="evidence-block"><div class="ev-head">📎 原文证据</div>${items}</div>`;
}

function renderGapSection(details, evidenceById) {
  const items = details.map(g => {
    const evs = (g.evidence_ids || []).map(id => evidenceById[id]).filter(Boolean);
    return `<div class="gap-item">
      <span class="gap-statement">${nl2br(g.statement)}</span> ${evidenceTypeBadge(g.type)}
      ${evs.length ? renderEvidenceBlock(evs) : ''}
    </div>`;
  }).join('');
  return `<div class="sec"><div class="sec-head">14 研究空白</div><div class="sec-body">${items || '<p class="empty">—</p>'}</div></div>`;
}

/* ---------- 对比 / Gap / 问答 ---------- */
function pickList(ids) {
  const items = state.papers.map(p => {
    const checked = state.selection.has(p.id);
    return `<label class="pick ${checked ? 'checked' : ''}">
      <input type="checkbox" data-pick="${esc(p.id)}" ${checked ? 'checked' : ''}>
      ${esc((p.title || p.filename || p.id).slice(0, 40))}
    </label>`;
  }).join('');
  return `<div class="pick-list">${items || '<span class="skeleton">暂无论文</span>'}</div>`;
}

function renderCompare() {
  view.innerHTML = `
    <div class="card">
      <h2>🆚 论文对比（技术路线演化 / 优缺点 / Research Gap）</h2>
      <p class="meta-line">在左侧列表勾选至少 2 篇论文，或在下方选择：</p>
      ${pickList()}
      <button id="btnCompare" class="btn">生成对比</button>
      <div id="compareResult" style="margin-top:14px"></div>
    </div>`;
}

function renderGap() {
  view.innerHTML = `
    <div class="card">
      <h2>🎯 Research Gap 研究空白发现</h2>
      <p class="meta-line">勾选论文后汇总 limitations / research_gap / possible_extensions：</p>
      ${pickList()}
      <button id="btnGap" class="btn">发现研究空白</button>
      <div id="gapResult" style="margin-top:14px"></div>
    </div>`;
}

function renderQa() {
  view.innerHTML = `
    <div class="card">
      <h2>💬 论文问答</h2>
      <p class="meta-line">勾选论文范围（不勾选则对全部论文提问）：</p>
      ${pickList()}
      <input id="qaQuestion" class="qa-input" placeholder="例如：这些论文的资源分配方法主要有哪些？">
      <div class="row" style="margin-top:10px">
        <button id="btnQa" class="btn">提问</button>
      </div>
      <div id="qaResult" style="margin-top:14px"></div>
    </div>`;
}

/* ---------- 事件 ---------- */
async function doAnalyze(id) {
  const btn = $('#analyzeBtn');
  btn.disabled = true; btn.textContent = '分析中…';
  try {
    await api('/papers/' + encodeURIComponent(id) + '/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_satellite: true }),
    });
    toast('分析完成');
    await selectPaper(id);
  } catch (e) {
    btn.disabled = false; btn.textContent = '分析论文';
    toast('分析失败: ' + e.message, true);
  }
}

async function doSaveNotes(id) {
  const notes = $('#notesArea').value;
  try {
    await api('/papers/' + encodeURIComponent(id) + '/notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    toast('笔记已保存');
  } catch (e) { toast('保存失败: ' + e.message, true); }
}

async function deletePaper(id) {
  const paper = state.papers.find(p => p.id === id);
  const title = paper ? (paper.title || paper.filename || id) : id;
  if (!confirm('确定删除这篇论文吗？\n\n' + title + '\n\n（此操作不可恢复）')) return;
  try {
    await api('/papers/' + encodeURIComponent(id), { method: 'DELETE' });
    if (state.selectedId === id) { state.selectedId = null; delete state.detailCache[id]; }
    if (state.selection.has(id)) state.selection.delete(id);
    toast('已删除');
    await loadPapers();
    switchTab();
  } catch (e) { toast('删除失败: ' + e.message, true); }
}

async function runCompare() {
  const ids = [...state.selection];
  if (ids.length < 2) { toast('请至少勾选 2 篇论文', true); return; }
  const btn = $('#btnCompare'); btn.disabled = true; btn.textContent = '对比中…';
  try {
    const r = await api('/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_ids: ids }) });
    let sw = '';
    for (const [pid, v] of Object.entries(r.strengths_weaknesses || {})) {
      const paper = r.papers.find(p => p.paper_id === pid);
      sw += `<div class="sec"><div class="sec-head">${esc((paper && paper.title) || pid)}</div>
        <div class="sec-body"><strong>优势：</strong><ul>${(v.strengths || []).map(s => '<li>' + esc(s) + '</li>').join('')}</ul>
        <strong>不足：</strong><ul>${(v.weaknesses || []).map(s => '<li>' + esc(s) + '</li>').join('')}</ul></div></div>`;
    }
    const gaps = (r.research_gap || []).map(g => '<li>' + esc(g) + '</li>').join('');
    $('#compareResult').innerHTML = `
      <div class="sec"><div class="sec-head">技术路线演化</div><div class="sec-body"><p>${nl2br(r.method_evolution || '')}</p></div></div>
      ${sw}
      <div class="sec"><div class="sec-head">综合 Research Gap</div><div class="sec-body"><ul>${gaps || '<li class="empty">—</li>'}</ul></div></div>`;
  } catch (e) { toast('对比失败: ' + e.message, true); }
  finally { btn.disabled = false; btn.textContent = '生成对比'; }
}

async function runGap() {
  const ids = [...state.selection];
  if (!ids.length) { toast('请至少勾选 1 篇论文', true); return; }
  const btn = $('#btnGap'); btn.disabled = true; btn.textContent = '分析中…';
  try {
    const r = await api('/gaps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_ids: ids }) });
    const gaps = (r.research_gaps || []).map(g => '<li>' + esc(g) + '</li>').join('');
    $('#gapResult').innerHTML = `<div class="sec"><div class="sec-head">汇总（${r.research_gaps ? r.research_gaps.length : 0} 条）</div><div class="sec-body"><ul>${gaps || '<li class="empty">—</li>'}</ul></div></div>
      <p class="meta-line">${esc(r.summary || '')}</p>`;
  } catch (e) { toast('失败: ' + e.message, true); }
  finally { btn.disabled = false; btn.textContent = '发现研究空白'; }
}

async function runQa() {
  const q = $('#qaQuestion').value.trim();
  if (!q) { toast('请输入问题', true); return; }
  const ids = [...state.selection];
  const btn = $('#btnQa'); btn.disabled = true; btn.textContent = '思考中…';
  try {
    const r = await api('/qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paper_ids: ids, question: q }) });
    const src = (r.sources || []).map(s => `<span class="chip">${esc(s.paper_id)} · ${esc(s.section)}</span>`).join('');
    $('#qaResult').innerHTML = `
      <div class="sec"><div class="sec-head">回答</div><div class="answer">${esc(r.answer || '')}</div></div>
      ${src ? `<div class="chips" style="margin-top:8px">来源：${src}</div>` : ''}`;
  } catch (e) { toast('提问失败: ' + e.message, true); }
  finally { btn.disabled = false; btn.textContent = '提问'; }
}

/* ---------- 上传 ---------- */
function setupUpload() {
  const dz = $('#dropzone');
  const input = $('#fileInput');
  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) uploadFile(input.files[0]); input.value = ''; });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('over');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) uploadFile(f);
  });
}

async function uploadFile(file) {
  toast('上传解析中: ' + file.name);
  try {
    const r = await api('/papers', {
      method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent(file.name) },
      body: file,
    });
    toast('导入成功: ' + r.id);
    await loadPapers();
    selectPaper(r.id);
  } catch (e) { toast('上传失败: ' + e.message, true); }
}

/* ---------- 全局事件委托 ---------- */
document.addEventListener('click', async (e) => {
  const del = e.target.closest('.del-btn');
  if (del) { deletePaper(del.dataset.del); return; }
  const tab = e.target.closest('.tab');
  if (tab) {
    state.tab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    switchTab();
    return;
  }
  const item = e.target.closest('.paper-item');
  if (item) {
    if (e.target.closest('input.sel')) return; // 勾选框交给 change 事件
    selectPaper(item.dataset.id);
    return;
  }
  const pick = e.target.closest('.pick');
  if (pick) {
    const cb = pick.querySelector('input');
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (e.target.id === 'btnCompare') { runCompare(); return; }
  if (e.target.id === 'btnGap') { runGap(); return; }
  if (e.target.id === 'btnQa') { runQa(); return; }
  if (e.target.id === 'analyzeBtn') { doAnalyze(e.target.dataset.id); return; }
  if (e.target.id === 'saveNotesBtn') { doSaveNotes(e.target.dataset.id); return; }
  if (e.target.id === 'btnClearSel') { state.selection.clear(); renderList(); rerenderCurrent(); return; }
});

document.addEventListener('change', (e) => {
  if (e.target.classList && e.target.classList.contains('sel')) {
    const id = e.target.dataset.id;
    if (e.target.checked) state.selection.add(id); else state.selection.delete(id);
    updateSelCount();
    rerenderCurrent();
  }
  if (e.target.dataset && e.target.dataset.pick) {
    const id = e.target.dataset.pick;
    if (e.target.checked) state.selection.add(id); else state.selection.delete(id);
    updateSelCount();
    rerenderCurrent();
  }
});

function rerenderCurrent() {
  if (state.tab === 'compare') renderCompare();
  else if (state.tab === 'gap') renderGap();
  else if (state.tab === 'qa') renderQa();
}

function switchTab() {
  if (state.tab === 'detail') {
    if (state.selectedId && state.detailCache[state.selectedId]) renderDetail(state.selectedId, state.detailCache[state.selectedId]);
    else if (state.selectedId) selectPaper(state.selectedId);
    else view.innerHTML = '<div class="placeholder"><div class="big">📚</div>选择左侧一篇论文查看结构化分析</div>';
  } else if (state.tab === 'compare') renderCompare();
  else if (state.tab === 'gap') renderGap();
  else if (state.tab === 'qa') renderQa();
}

/* ---------- 初始化 ---------- */
document.getElementById('searchBox').addEventListener('input', renderList);
setupUpload();
loadPapers();
switchTab();
