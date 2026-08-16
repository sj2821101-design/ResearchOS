'use strict';
// 章节识别 + 元数据提取（纯规则启发式，等价于 Python 版 structure.py）。

const SECTION_ALIASES = [
  ['abstract', ['abstract', 'summary', '摘要', '内容提要']],
  ['keywords', ['keywords', 'index terms', 'key words', 'keyword', '关键词', '关键字']],
  ['introduction', ['introduction', 'intro', '引言', '绪论', '前言', '研究背景', '问题背景']],
  ['related_work', ['related work', 'related works', 'related studies', 'background',
    'literature review', 'prior work', 'previous work', 'state of the art', 'related literature',
    '相关工作', '文献综述', '国内外研究现状', '研究现状']],
  ['system_model', ['system model', 'system architecture', 'network model', 'system overview',
    'system and channel model', 'architecture overview', 'network architecture',
    'system scenario', 'scenario description', '系统模型', '系统架构', '网络模型', '场景描述']],
  ['problem_formulation', ['problem formulation', 'problem statement', 'problem definition',
    'problem setup', 'problem description', '问题描述', '问题建模', '问题定义', '问题陈述']],
  ['method', ['proposed method', 'proposed approach', 'proposed scheme', 'proposed algorithm',
    'method', 'methodology', 'approach', 'our method', 'our approach', 'the proposed method',
    'proposed solution', 'proposed framework', 'methods', 'scheme design',
    '方法', '研究方法', '本文方法', '所提方法']],
  ['mathematical_formulation', ['mathematical formulation', 'mathematical model', 'mathematical analysis',
    'formulation', 'problem modeling', 'modeling', 'mathematical framework', '数学模型', '公式推导', '数学建模']],
  ['algorithm', ['algorithm', 'the algorithm', 'algorithms', 'proposed algorithm', 'algorithm design',
    'algorithm description', '算法', '算法设计', '算法描述', '本文算法']],
  ['experiments', ['experiment', 'experiments', 'experimental', 'experimental results', 'evaluation',
    'performance evaluation', 'simulation', 'simulations', 'simulation results',
    'numerical results', 'results', 'results and discussion', 'results and analysis',
    'performance analysis', 'case study', 'case studies', 'experimental setup',
    'simulation setup', 'experimental design',
    '实验', '实验结果', '实验分析', '仿真', '仿真实验', '仿真结果', '仿真例子', '仿真实例', '数值仿真', '数值例子', '算例', '性能评估', '性能分析']],
  ['conclusion', ['conclusion', 'conclusions', 'conclusion and future work', 'concluding remarks',
    'summary and conclusion', '结论', '总结', '结束语', '总结与展望']],
  ['discussion', ['discussion', 'discussions', '讨论']],
  ['future_work', ['future work', 'future works', 'future directions', 'future research', '未来工作', '展望']],
  ['references', ['references', 'bibliography', 'bibliographic', '参考文献', '文献']],
];

function cleanHeading(line) {
  let s = line.trim();
  s = s.replace(/^\d{1,2}(?:\.\d+){0,3}\.?[\s.]*/, '');
  s = s.replace(/^([A-I]|[IVX]{1,4})\.\s+/, '');
  s = s.replace(/[:\-–—]*\s*$/, '');
  return s.trim().toLowerCase();
}

function classifyHeading(line) {
  const cleaned = cleanHeading(line);
  if (!cleaned) return null;
  for (const [canonical, aliases] of SECTION_ALIASES) {
    for (const alias of aliases) {
      if (cleaned === alias || cleaned.startsWith(alias + ' ') || cleaned.startsWith(alias + ':')) {
        return canonical;
      }
    }
  }
  return null;
}

function isProbableHeading(line) {
  const s = line.trim();
  if (!s || s.length > 90) return false;
  if ('.!?,'.includes(s[s.length - 1])) return false;
  if (classifyHeading(s)) return true;
  const m = s.match(/^(\d{1,2}(?:\.\d+){0,3})\.?\s+(.+)$/);
  if (m && m[2].length <= 70) return true;
  return false;
}

function detectSections(text) {
  const lines = String(text || '').split(/\r?\n/);
  const result = {};
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) {
      const body = buf.join('\n').trim();
      if (body) result[current] = result[current] ? (result[current] + '\n\n' + body).trim() : body;
    }
    buf = [];
  };
  for (const line of lines) {
    const canonical = isProbableHeading(line) ? classifyHeading(line) : null;
    if (canonical) { flush(); current = canonical; continue; }
    buf.push(line);
  }
  flush();
  return result;
}

function looksLikeAffiliation(line) {
  const low = line.toLowerCase();
  return ['@', 'university', 'univ.', 'institute', 'department', 'school', 'laboratory',
    'lab.', 'college', 'china', 'beijing', 'shanghai', 'corp', 'ltd', 'inc', 'academy',
    'center', 'centre', 'email', 'corresponding'].some(m => low.includes(m));
}

function looksLikeAuthorLine(s) {
  // 短行 + 作者特征（逗号分隔/中文名带数字上标/and 连接），用于标题分行
  if (s.length >= 80) return false;
  if (/[,，]/.test(s)) return true;
  if (/[\u4e00-\u9fff]+\s*\d/.test(s)) return true;
  if (/\band\b/i.test(s)) return true;
  return false;
}

const AUTHOR_STOP_WORDS = new Set(['member', 'senior', 'fellow', 'ieee', 'and', 'author', 'authors']);

function cleanAuthorTokens(line) {
  const out = [];
  for (const raw of String(line || '').split(/[,;，；]|\band\b/)) {
    let p = raw.trim().replace(/^[,;，；\s]+/, '');
    p = p.replace(/[\d\s]+$/, '').trim();   // 去数字上标（如 王雪梅1 → 王雪梅）
    if (!p || p.length > 30) continue;   // 姓名较短，超长为正文碎片
    if (/^\d+$/.test(p)) continue;
    if (AUTHOR_STOP_WORDS.has(p.toLowerCase())) continue;
    out.push(p);
  }
  return out;
}

function isNoiseLine(line) {
  const s = String(line || '').trim();
  if (!s) return true;
  const low = s.toLowerCase();
  // 页码 + 刊名/会议名的运行页眉（如 "8052 IEEE TRANSACTIONS ON ..."）
  if (/^\d{1,6}\s*(ieee|acm|springer|elsevier|wiley|proceedings|conference)\b/.test(low)) return true;
  // 卷/期：Vol. 42, No. 8
  if (/\bvol\.?\s*\d+/i.test(low) && /\bno\.?\s*\d+/i.test(low)) return true;
  // DOI / ISSN
  if (/^(doi\s*[:：]|digital object identifier)/i.test(low)) return true;
  if (/^issn\b/i.test(low)) return true;
  // 纯页码
  if (/^\d{1,5}$/.test(low)) return true;
  // MONTH YEAR（如 OCTOBER 2018 / August, 2016）
  if (/^(january|february|march|april|may|june|july|august|september|october|november|december)[,.]?\s+\d{4}$/i.test(low)) return true;
  // 版权行
  if (/^copyright\b/i.test(low) || /^©\s*\d{4}/.test(low)) return true;
  // 中文卷/期/日期/期刊名页眉
  if (/第\s*[0-9]+\s*[卷期]/.test(s)) return true;
  if (/[0-9]{4}\s*年\s*[0-9]+\s*月/.test(s)) return true;
  if (/学\s*报\s*$/.test(s) && s.length <= 20) return true;
  if (/大\s*学\s*$/.test(s) && s.length <= 20) return true;
  // 全大写刊名/页眉（如 ACTA AUTOMATICA SINICA）
  if (/^(acta|journal|transactions|proceedings|letters|magazine|review|ieee|acm|springer|elsevier|wiley)\b/i.test(low) && !/[a-z]/.test(s)) return true;
  // 单个汉字（竖排刊名碎片，如 "自" "动" "化"）
  if (/^[\u4e00-\u9fff]$/.test(s)) return true;
  return false;
}

function extractYear(text, pdfMeta) {
  const head = String(text || '').slice(0, 4000);
  // 1) 正文出版上下文：© / copyright 年份（最可靠的出版年）
  let m = head.match(/(?:©|\(c\)|copyright)\s*(19|20)\d{2}/i);
  if (m) return parseInt(m[0].match(/\d{4}/)[0], 10);
  // 2) 中文出版日期：2016 年8 月
  m = head.match(/(19|20)\d{2}\s*年\s*\d{1,2}\s*月/);
  if (m) return parseInt(m[0].match(/\d{4}/)[0], 10);
  // 3) 出版标记：2024 IEEE / Proceedings 2024
  const PUB = 'IEEE|ACM|Springer|Elsevier|Wiley|Proceedings|Conference|Symposium|Workshop|Journal|Transactions|arXiv';
  m = head.match(new RegExp('(19|20)\\d{2}\\s*(?:' + PUB + ')', 'i'));
  if (m) return parseInt(m[0].slice(0, 4), 10);
  m = head.match(new RegExp('(?:' + PUB + ')\\s*(19|20)\\d{2}', 'i'));
  if (m) return parseInt(m[0].match(/\d{4}/)[0], 10);
  // 4) PDF 元数据日期（文件生成时间，最后兜底）
  for (const key of ['CreationDate', 'ModDate']) {
    const raw = (pdfMeta && pdfMeta[key]) || '';
    const dm = raw.match(/D:(\d{4})/);
    if (dm) {
      const y = parseInt(dm[1], 10);
      if (y >= 1900 && y <= 2100) return y;
    }
  }
  return null;
}

function extractMetadata(text, pdfMeta) {
  const lines = String(text || '').split(/\r?\n/);
  const nonempty = lines.map(l => l.trim()).filter(Boolean);
  let abstractIdx = -1;
  for (let i = 0; i < nonempty.length; i++) {
    if (classifyHeading(nonempty[i]) === 'abstract') { abstractIdx = i; break; }
  }

  const metaTitle = (pdfMeta && pdfMeta.Title || '').trim();
  let title = (metaTitle.length > 3 && !['untitled', 'none'].includes(metaTitle.toLowerCase()) && !isNoiseLine(metaTitle)) ? metaTitle : '';
  if (!title) {
    const head = nonempty.slice(0, abstractIdx >= 0 ? abstractIdx : Math.min(12, nonempty.length));
    const cand = [];
    for (const l of head) {
      const s = l.trim();
      if (!s || isNoiseLine(s)) continue;   // 跳过页眉/页脚等噪声行
      if (s.length > 220 || looksLikeAffiliation(s) || looksLikeAuthorLine(s)) break;
      cand.push(s);
      if (cand.join(' ').length > 200) break;   // 支持跨行标题
    }
    title = cand.length ? cand.join(' ').replace(/[ .:\-]+$/, '') : '';
  }

  const metaAuthors = (pdfMeta && pdfMeta.Author || '').trim();
  let authors = [];
  // 优先正文提取（更可靠）：定位标题之后，收集作者行直到机构/标题/长句（正文）
  {
    let startIdx = 0;
    for (let i = 0; i < nonempty.length; i++) {
      const s = nonempty[i].trim();
      if (title && s.length >= 4 && title.includes(s)) startIdx = i + 1;
    }
    for (let i = startIdx; i < Math.min(startIdx + 10, nonempty.length); i++) {
      const s = nonempty[i].trim();
      if (!s || isNoiseLine(s)) continue;
      if (looksLikeAffiliation(s) || classifyHeading(s) || s.length > 40) break;
      authors = authors.concat(cleanAuthorTokens(s));
      if (authors.length >= 12) break;
    }
  }
  // 兜底：PDF 元数据作者（可能被污染，仅当正文未提取到）
  if (!authors.length && metaAuthors && !isNoiseLine(metaAuthors)) {
    authors = cleanAuthorTokens(metaAuthors).slice(0, 12);
  }

  const year = extractYear(text, pdfMeta);

  let venue = '';
  const vm = String(text).slice(0, 6000).match(/(Proceedings of [A-Za-z0-9 ,'&-]+|Journal of [A-Za-z0-9 ,'&-]+|IEEE Transactions on [A-Za-z0-9 ,'&-]+|arXiv)/);
  if (vm) venue = vm[0].trim();

  let doi = '';
  const dm = String(text).slice(0, 8000).match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
  if (dm) doi = dm[0].replace(/[.,;]+$/, '');

  const sections = detectSections(text);
  let abstract = (sections.abstract || '').trim();

  let keywords = [];
  const kwSection = sections.keywords || '';
  if (kwSection) {
    const cleaned = kwSection.replace(/^(keywords?|index terms|key words)\s*[:：]?\s*/i, '');
    const firstLine = cleaned.split('\n')[0];
    keywords = firstLine.split(/[;,，；]/).map(k => k.trim()).filter(Boolean).slice(0, 20);
  }
  if (!keywords.length) {
    const m = String(text).match(/^\s*(keywords?|index terms|key words)\s*[:：]\s*(.+)$/im);
    if (m) keywords = m[2].split(/[;,，；]/).map(k => k.trim()).filter(Boolean).slice(0, 20);
  }

  return { title: title.trim(), authors, year, venue, doi, abstract, keywords };
}

module.exports = { detectSections, extractMetadata, extractYear, isNoiseLine };
