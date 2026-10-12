const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { getOllamaStatus, pullOllamaModel, validateModelName, normalizeBaseUrl } = require('../electron/ollama.cjs');

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('validates model tags while rejecting traversal and malformed names', () => {
  assert.equal(validateModelName('qwen3.5:2b'), 'qwen3.5:2b');
  assert.equal(validateModelName('team/model:Q4_K_M'), 'team/model:Q4_K_M');
  assert.throws(() => validateModelName('../private'), /valid Ollama model name/);
  assert.throws(() => validateModelName('model; rm -rf /'), /valid Ollama model name/);
});

test('reports Ollama version and installed model inventory', async () => {
  await withServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/version') res.end(JSON.stringify({ version: '0.16.0' }));
    else if (req.url === '/api/tags') res.end(JSON.stringify({ models: [{ name: 'qwen3.5:2b', size: 1234 }] }));
    else { res.statusCode = 404; res.end('{}'); }
  }, async (base) => {
    const status = await getOllamaStatus(base);
    assert.equal(status.available, true);
    assert.equal(status.version, '0.16.0');
    assert.equal(status.models[0].name, 'qwen3.5:2b');
  });
});

test('parses streamed pull progress and reports completion', async () => {
  await withServer(async (req, res) => {
    if (req.url !== '/api/pull' || req.method !== 'POST') { res.statusCode = 404; res.end(); return; }
    const body = await new Promise((resolve) => { let value = ''; req.on('data', (chunk) => value += chunk); req.on('end', () => resolve(value)); });
    assert.equal(JSON.parse(body).model, 'qwen3.5:2b');
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    res.write('{"status":"pulling manifest"}\n');
    res.write('{"status":"downloading","total":100,"completed":25}\n');
    res.end('{"status":"success"}\n');
  }, async (base) => {
    const progress = [];
    const result = await pullOllamaModel('qwen3.5:2b', (item) => progress.push(item), base);
    assert.equal(result.status, 'success');
    assert.equal(progress[1].percent, 25);
    assert.equal(progress.at(-1).status, 'success');
  });
});


test('model pull supports cancellation while the progress stream is open', async () => {
  const controller = new AbortController();
  let started;
  const requestStarted = new Promise(resolve => { started = resolve; });
  await withServer((req, res) => {
    if (req.url !== '/api/pull') { res.statusCode = 404; res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    res.write('{"status":"downloading","total":100,"completed":1}\\n');
    started();
    // Keep the response open until the client aborts it.
  }, async base => {
    const pending = pullOllamaModel('qwen3.5:2b', () => {}, base, fetch, { signal: controller.signal, timeoutMs: 5000 });
    await requestStarted;
    controller.abort();
    await assert.rejects(pending, /cancelled/i);
  });
});


test('model pull times out when Ollama never responds', async () => {
  await withServer((req, res) => {
    if (req.url === '/api/pull') {
      // Deliberately never send headers or a body; the client must time out.
      return;
    }
    res.statusCode = 404;
    res.end();
  }, async base => {
    await assert.rejects(
      pullOllamaModel('qwen3.5:2b', () => {}, base, fetch, { timeoutMs: 1000 }),
      /timed out/i
    );
  });
});


test('Ollama endpoint validation blocks credential-bearing URLs and plaintext remote hosts', () => {
  assert.equal(normalizeBaseUrl('http://127.0.0.1:11434/'), 'http://127.0.0.1:11434');
  assert.equal(normalizeBaseUrl('https://ollama.example.test:11434/'), 'https://ollama.example.test:11434');
  assert.throws(() => normalizeBaseUrl('http://ollama.example.test:11434'), /remote Ollama endpoints must use HTTPS/i);
  assert.throws(() => normalizeBaseUrl('https://user:secret@ollama.example.test:11434'), /cannot contain credentials/i);
  assert.throws(() => normalizeBaseUrl('https://ollama.example.test:11434?token=secret'), /cannot contain credentials/i);
  assert.throws(() => normalizeBaseUrl('https://ollama.example.test:11434/#admin'), /cannot contain credentials/i);
  assert.throws(() => normalizeBaseUrl('not a url'), /base URL is invalid/i);
});
