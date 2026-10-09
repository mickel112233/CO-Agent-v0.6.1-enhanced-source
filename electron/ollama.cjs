const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

function normalizeBaseUrl(value = DEFAULT_OLLAMA_URL) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Ollama URL must use HTTP or HTTPS.');
  return url.toString().replace(/\/+$/, '');
}
function validateModelName(value) {
  const name = String(value || '').trim();
  if (name.length < 1 || name.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$/.test(name) || name.includes('..') || name.includes('//')) {
    throw new Error('Enter a valid Ollama model name, for example qwen3.5:2b.');
  }
  return name;
}
async function readError(response) {
  let message = '';
  try { message = (await response.text()).slice(0, 1200); } catch { /* ignore body read errors */ }
  return new Error(`Ollama returned ${response.status}${message ? `: ${message}` : ''}`);
}

async function getOllamaStatus(baseUrl = process.env.ATELIER_OLLAMA_URL || DEFAULT_OLLAMA_URL, fetchImpl = fetch) {
  const base = normalizeBaseUrl(baseUrl);
  try {
    const [versionResponse, tagsResponse] = await Promise.all([
      fetchImpl(`${base}/api/version`, { signal: AbortSignal.timeout(6000) }),
      fetchImpl(`${base}/api/tags`, { signal: AbortSignal.timeout(6000) })
    ]);
    if (!versionResponse.ok) throw await readError(versionResponse);
    if (!tagsResponse.ok) throw await readError(tagsResponse);
    const [version, tags] = await Promise.all([versionResponse.json(), tagsResponse.json()]);
    return { available: true, baseUrl: base, version: version.version || 'unknown', models: Array.isArray(tags.models) ? tags.models : [] };
  } catch (error) {
    return { available: false, baseUrl: base, version: '', models: [], error: error.message || 'Ollama is not responding.' };
  }
}

async function pullOllamaModel(model, onProgress = () => {}, baseUrl = process.env.ATELIER_OLLAMA_URL || DEFAULT_OLLAMA_URL, fetchImpl = fetch) {
  const name = validateModelName(model);
  const base = normalizeBaseUrl(baseUrl);
  const response = await fetchImpl(`${base}/api/pull`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: name, stream: true })
  });
  if (!response.ok) throw await readError(response);
  if (!response.body) throw new Error('Ollama did not return a model-download progress stream.');

  const decoder = new TextDecoder();
  let buffer = '', last = null;
  const consume = (line) => {
    const text = line.trim();
    if (!text) return;
    let item;
    try { item = JSON.parse(text); }
    catch { throw new Error('Ollama returned invalid model-download progress data.'); }
    if (item.error) throw new Error(`Ollama pull failed: ${item.error}`);
    last = item;
    const total = Number(item.total) || 0;
    const completed = Number(item.completed) || 0;
    onProgress({ model: name, status: item.status || 'Downloading model…', digest: item.digest || '', total, completed, percent: total > 0 ? Math.min(100, Math.floor(completed / total * 100)) : null });
  };
  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const rows = buffer.split(/\r?\n/);
    buffer = rows.pop() || '';
    for (const row of rows) consume(row);
  }
  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
  if (!last || last.status !== 'success') throw new Error(last?.status || 'Ollama ended the pull before reporting success.');
  return { model: name, status: 'success' };
}

async function deleteOllamaModel(model, baseUrl = process.env.ATELIER_OLLAMA_URL || DEFAULT_OLLAMA_URL, fetchImpl = fetch) {
  const name = validateModelName(model);
  const base = normalizeBaseUrl(baseUrl);
  const response = await fetchImpl(`${base}/api/delete`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: name }) });
  if (!response.ok) throw await readError(response);
  return { deleted: name };
}

module.exports = { DEFAULT_OLLAMA_URL, normalizeBaseUrl, validateModelName, getOllamaStatus, pullOllamaModel, deleteOllamaModel };
