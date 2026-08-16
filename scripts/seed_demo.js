'use strict';
// 向正在运行的服务器上传并分析样例论文，快速得到一个可演示的论文库。
// 用法：先 node server/server.js，再 node scripts/seed_demo.js
const fs = require('fs');
const path = require('path');
const BASE = process.env.RESEARCHOS_BASE || 'http://127.0.0.1:8000';

(async () => {
  const pdfPath = path.join(__dirname, '..', 'sample', 'sample_satellite_iot.pdf');
  if (!fs.existsSync(pdfPath)) { console.error('sample pdf not found:', pdfPath); process.exit(1); }
  const buf = fs.readFileSync(pdfPath);

  const up = await fetch(BASE + '/api/papers', {
    method: 'POST', headers: { 'X-Filename': 'sample_satellite_iot.pdf', 'Content-Type': 'application/pdf' }, body: buf,
  });
  const upJson = await up.json();
  console.log('uploaded:', up.status, upJson.id || JSON.stringify(upJson));

  const an = await fetch(BASE + '/api/papers/' + upJson.id + '/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ include_satellite: true }),
  });
  const anJson = await an.json();
  console.log('analyzed:', an.status, 'provider=', anJson.provider, 'sections=', Object.keys(anJson.sections || {}).length);
  console.log('DONE');
})().catch(e => { console.error('SEED ERROR:', e && e.message || e); process.exit(1); });
