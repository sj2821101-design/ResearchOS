'use strict';
// 零依赖配置：从环境变量读取，可选加载项目根目录 .env。
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..'); // server/lib -> server -> ResearchOS

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotenv(path.join(PROJECT_ROOT, '.env'));

function resolveDataDir(raw) {
  const p = raw && raw.trim() ? raw : './data';
  return path.isAbsolute(p) ? p : path.resolve(PROJECT_ROOT, p);
}

const config = {
  projectRoot: PROJECT_ROOT,
  dataDir: resolveDataDir(process.env.RESEARCHOS_DATA_DIR),
  host: process.env.RESEARCHOS_HOST || '127.0.0.1',
  port: parseInt(process.env.RESEARCHOS_PORT || '8000', 10),
  llmProvider: (process.env.LLM_PROVIDER || 'heuristic').toLowerCase(),
  llmModel: process.env.LLM_MODEL || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiCompatibleBaseUrl: (process.env.OPENAI_COMPATIBLE_BASE_URL || '').replace(/\/+$/, ''),
  openaiCompatibleApiKey: process.env.OPENAI_COMPATIBLE_API_KEY || '',
};

module.exports = config;
