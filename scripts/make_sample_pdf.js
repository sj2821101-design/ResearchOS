'use strict';
// 生成一篇「天基物联网 / LEO 卫星资源分配」主题的样例论文 PDF（FlateDecode 压缩），
// 用于端到端测试 ResearchOS V1 的导入与解析链路。
// 用法：node scripts/make_sample_pdf.js [输出目录]
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'sample'));
fs.mkdirSync(outDir, { recursive: true });

const SECTIONS = [
  { heading: 'Joint Resource Allocation and Access Control in LEO Satellite IoT: A Deep Reinforcement Learning Approach',
    paragraphs: [
      'Alice Zhang, Bob Li, Carol Wang',
    ] },
  { heading: 'Abstract', paragraphs: [
    'Low Earth Orbit (LEO) satellite constellations are emerging as a key enabler for global Internet of Things (IoT) connectivity. This paper studies the joint resource allocation and access control problem in a LEO satellite IoT network with heterogeneous terminals. We formulate the problem as a constrained optimization that maximizes the weighted sum throughput while guaranteeing per-terminal latency and energy constraints. A deep reinforcement learning based algorithm is proposed to solve the mixed-integer problem efficiently. Simulation results show that the proposed scheme outperforms OFDMA, TDMA, and greedy baselines in terms of throughput, latency, and fairness.',
  ] },
  { heading: '1. Introduction', paragraphs: [
    'Satellite IoT is important because it provides coverage to remote areas where terrestrial networks are unavailable. However, the limited spectrum, dynamic channel conditions, and high mobility of LEO satellites make resource allocation challenging. Existing methods are limited by high computational complexity and cannot adapt to time-varying traffic. Motivated by these challenges, this paper proposes a learning-based resource allocation framework.',
  ] },
  { heading: '2. Related Work', paragraphs: [
    'Prior work on satellite resource allocation includes fixed TDMA/FDMA schemes and convex optimization based power allocation. Recent studies apply deep reinforcement learning to spectrum sharing in terrestrial networks. However, few works consider the joint access control and resource allocation under LEO mobility and Rician fading channels.',
  ] },
  { heading: '3. System Model', paragraphs: [
    'We consider a Walker constellation with 60 LEO satellites at 550 km altitude and 53 degree inclination. Each satellite serves multiple IoT terminals through a multi-beam antenna. The channel model follows Rician fading with free-space path loss and Doppler shift. The access model supports grant-free random access and NOMA in each beam.',
  ] },
  { heading: '4. Problem Formulation', paragraphs: [
    'The joint resource allocation and access control problem is formulated as a mixed-integer nonlinear optimization. The objective is to maximize the weighted sum throughput subject to per-terminal transmit power, latency, and reliability constraints. The optimization objective couples beam assignment, subchannel allocation, and power control.',
  ] },
  { heading: '5. Proposed Method', paragraphs: [
    'We propose a deep reinforcement learning algorithm based on the PPO framework. The state space includes channel gains, queue lengths, and satellite positions. The action space includes beam selection, subchannel assignment, and power levels. A reward shaping term encourages low latency and high energy efficiency.',
  ] },
  { heading: '6. Algorithm', paragraphs: [
    'The proposed algorithm iteratively samples trajectories, estimates advantages, and updates the policy network. The computational complexity of each iteration is O(KN) where K is the number of terminals and N is the number of subchannels. Convergence is reached within 2000 episodes in our simulations.',
  ] },
  { heading: '7. Experiments', paragraphs: [
    'We simulate 60 LEO satellites and 300 IoT terminals over 10000 time slots. The carrier frequency is 20 GHz and the bandwidth is 10 MHz. Baseline algorithms include OFDMA, TDMA, random access, and a greedy heuristic. The performance metrics are throughput, latency, energy efficiency, spectral efficiency, and fairness. Results show that our method improves sum throughput by 18 percent and reduces average latency by 23 percent.',
  ] },
  { heading: '8. Conclusion', paragraphs: [
    'This paper proposed a DRL-based joint resource allocation and access control scheme for LEO satellite IoT. The main contributions are a new problem formulation and a low-complexity learning algorithm. Limitations include the assumption of perfect channel state information and a simplified mobility model. Future work includes multi-satellite coordination and robust learning under partial observability.',
  ] },
  { heading: 'References', paragraphs: [
    '[1] Author A. et al., "Satellite IoT resource allocation: a survey," IEEE Journal, 2024.',
    '[2] Author B. et al., "Deep reinforcement learning for LEO networks," IEEE Transactions, 2023.',
  ] },
];

function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

function buildContent(sections) {
  const lines = ['BT', '/F1 11 Tf', '16 TL', '60 760 Td'];
  for (const sec of sections) {
    lines.push(`(${esc(sec.heading)}) Tj`, 'T*');
    for (const p of sec.paragraphs) lines.push(`(${esc(p)}) Tj`, 'T*');
    lines.push('T*');
  }
  lines.push('ET');
  return lines.join('\n');
}

function buildPdf(contentText) {
  const compressed = zlib.deflateSync(Buffer.from(contentText, 'latin1'));
  const chunks = [];
  const offsets = {};
  let pos = 0;
  const add = (buf, num) => { if (num) offsets[num] = pos; chunks.push(buf); pos += buf.length; };

  add(Buffer.from('%PDF-1.4\n', 'latin1'));
  add(Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'latin1'), 1);
  add(Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 'latin1'), 2);
  add(Buffer.from('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n', 'latin1'), 3);
  add(Buffer.from('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n', 'latin1'), 4);
  add(Buffer.from(`5 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), 5);
  add(compressed);
  add(Buffer.from('\nendstream\nendobj\n', 'latin1'));

  const xrefOffset = pos;
  const maxObj = 5;
  let xref = `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObj; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, 'latin1'));
  return Buffer.concat(chunks);
}

const pdfBuf = buildPdf(buildContent(SECTIONS));
const outFile = path.join(outDir, 'sample_satellite_iot.pdf');
fs.writeFileSync(outFile, pdfBuf);
console.log('written:', outFile, `(${pdfBuf.length} bytes)`);
