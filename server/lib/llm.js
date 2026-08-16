'use strict';
// LLM 抽象层（零依赖）：用 Node 内置 fetch 调 OpenAI / Claude / OpenAI 兼容端点。
// 无 Key 或调用失败时回退 heuristic（返回空文本，由上层走本地规则）。
const config = require('./config');

class ProviderError extends Error {}

const LLM_TIMEOUT_MS = 120000;

function fetchWithTimeout(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  return fetch(url, Object.assign({}, opts, { signal: controller.signal }))
    .finally(() => clearTimeout(timer));
}

async function openaiComplete({ baseUrl, apiKey, model }, system, user, temperature = 0.2, maxTokens = 8000) {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  let resp;
  try {
    resp = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ProviderError(`LLM request timed out (${LLM_TIMEOUT_MS}ms)`);
    throw new ProviderError(`LLM request failed: ${e && e.message}`);
  }
  if (!resp.ok) throw new ProviderError(`OpenAI HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
  return { text, model: data.model || model };
}

async function anthropicComplete(apiKey, model, system, user, temperature = 0.2, maxTokens = 8000) {
  let resp;
  try {
    resp = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] }),
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new ProviderError(`LLM request timed out (${LLM_TIMEOUT_MS}ms)`);
    throw new ProviderError(`LLM request failed: ${e && e.message}`);
  }
  if (!resp.ok) throw new ProviderError(`Anthropic HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  const text = (data.content || []).map(b => b.text || '').join('');
  return { text, model: data.model || model };
}

function getProvider(name, model) {
  name = (name || config.llmProvider || 'heuristic').toLowerCase();
  model = model || config.llmModel || '';

  if (name === 'openai') {
    const m = model || 'gpt-4o-mini';
    return {
      name: 'openai', model: m, available: () => !!config.openaiApiKey,
      complete: (s, u, t, mx) => openaiComplete({ baseUrl: config.openaiBaseUrl, apiKey: config.openaiApiKey, model: m }, s, u, t, mx),
    };
  }
  if (name === 'anthropic') {
    const m = model || 'claude-sonnet-4-20250514';
    return {
      name: 'anthropic', model: m, available: () => !!config.anthropicApiKey,
      complete: (s, u, t, mx) => anthropicComplete(config.anthropicApiKey, m, s, u, t, mx),
    };
  }
  if (name === 'openai_compatible') {
    const m = model || 'deepseek-chat';
    return {
      name: 'openai_compatible', model: m, available: () => !!config.openaiCompatibleApiKey && !!config.openaiCompatibleBaseUrl,
      complete: (s, u, t, mx) => openaiComplete({ baseUrl: config.openaiCompatibleBaseUrl, apiKey: config.openaiCompatibleApiKey, model: m }, s, u, t, mx),
    };
  }
  return { name: 'heuristic', model: '', available: () => true, complete: async () => ({ text: '', model: 'heuristic' }) };
}

module.exports = { getProvider, ProviderError };
