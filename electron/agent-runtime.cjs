function makeMessages(agent, task) {
  const system = `You are a read-only child agent named ${agent.name}. Your independent task is: ${task.title}. Apply these profile instructions: ${agent.instructions}. You cannot browse the web, read workspace files, call tools, modify files, or save memory. Use only the self-contained task prompt. Do not claim to have performed unavailable actions. Return concise evidence-aware findings, key risks, and any uncertainty.`;
  return { system, prompt: String(task.prompt || '').slice(0, 6000) };
}

function validateProvider(provider, key) {
  if (!provider || !['openai', 'anthropic', 'gemini'].includes(provider.protocol)) throw new Error('Choose a supported API provider protocol.');
  if (typeof provider.model !== 'string' || !provider.model.trim() || provider.model.length > 200) throw new Error('Enter a valid provider model name (1–200 characters).');
  if (typeof provider.baseUrl !== 'string' || !provider.baseUrl.trim() || provider.baseUrl.length > 2048) throw new Error('Enter a valid API base URL.');
  let url;
  try { url = new URL(provider.baseUrl); } catch { throw new Error('The API base URL is invalid.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('API endpoints must use HTTPS (HTTP is allowed only for loopback local services).');
  if (url.username || url.password || url.search || url.hash) throw new Error('API base URLs cannot contain credentials, query parameters, or fragments.');
  if (provider.protocol !== 'openai' && (typeof key !== 'string' || !key.trim())) throw new Error('An API key is required for this provider.');
  if (typeof key !== 'string' || key.length > 4096) throw new Error('API key is invalid or too long.');
  return { ...provider, baseUrl: url.toString().replace(/\/+$/, ''), model: provider.model.trim() };
}

async function readOnlySubagent(provider, key, agent, task, fetchImpl = fetch) {
  provider = validateProvider(provider, key);
  const { system, prompt } = makeMessages(agent, task);
  const timeout = AbortSignal.timeout(180_000);
  let endpoint, headers, body;
  if (provider.protocol === 'openai') {
    endpoint = /\/chat\/completions\/?$/.test(provider.baseUrl)
      ? provider.baseUrl.replace(/\/$/, '')
      : `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    headers = { 'content-type': 'application/json' };
    if (key) headers.authorization = `Bearer ${key}`;
    body = { model: provider.model, stream: false, max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
  } else if (provider.protocol === 'anthropic') {
    endpoint = provider.baseUrl.replace(/\/+$/, '');
    if (!endpoint.endsWith('/messages')) endpoint += '/messages';
    headers = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    body = { model: provider.model, max_tokens: 2048, system, messages: [{ role: 'user', content: prompt }] };
  } else if (provider.protocol === 'gemini') {
    endpoint = `${provider.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(key)}`;
    headers = { 'content-type': 'application/json' };
    body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } };
  } else {
    throw new Error(`Unsupported child-agent provider protocol: ${provider.protocol}`);
  }
  const response = await fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: timeout });
  if (!response.ok) throw new Error(`Provider returned ${response.status}: ${(await response.text()).slice(0, 1200)}`);
  const result = await response.json();
  let text = '';
  if (provider.protocol === 'openai') {
    const content = result.choices?.[0]?.message?.content;
    text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((item) => item.text || '').join('') : '';
  } else if (provider.protocol === 'anthropic') {
    text = (result.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('');
  } else {
    text = (result.candidates?.[0]?.content?.parts || []).filter((part) => typeof part.text === 'string').map((part) => part.text).join('');
  }
  return String(text || '').slice(0, 12_000);
}

function allocateSubagentTasks(context, requested) {
  const tasks = Array.isArray(requested) ? requested.slice(0, 3) : [];
  const budget = Number.isFinite(context.remainingSubagents) ? Math.max(0, context.remainingSubagents) : 0;
  const selected = tasks.slice(0, budget);
  context.remainingSubagents = budget - selected.length;
  return selected;
}

module.exports = { readOnlySubagent, allocateSubagentTasks, validateProvider };
