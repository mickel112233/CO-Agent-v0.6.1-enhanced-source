const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { getOllamaStatus, pullOllamaModel, validateModelName } = require('../electron/ollama.cjs');

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


test('cancels a model pull by aborting the in-flight fetch and stream reader', async () => {
  const controller = new AbortController();
  let observedSignal;
  const fetchImpl = async (_url, options) => {
    observedSignal = options.signal;
    return new Response(new ReadableStream({
      start(stream) { stream.enqueue(new TextEncoder().encode('{"status":"downloading","total":100,"completed":1}' + String.fromCharCode(10))); },
      cancel() {}
    }), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
  };
  const pending = pullOllamaModel('qwen3.5:2b', () => {}, 'http://127.0.0.1:11434', fetchImpl, controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, /cancel/i);
  assert.equal(observedSignal, controller.signal);
});


test('normalizes cancellation while the Ollama pull request is still connecting', async () => {
  const controller = new AbortController();
  const fetchImpl = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('This operation was aborted', 'AbortError')), { once: true });
  });
  const pending = pullOllamaModel('qwen3.5:2b', () => {}, 'http://127.0.0.1:11434', fetchImpl, controller.signal);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, /model download cancelled/i);
});


test('does not issue a pull request when cancellation already happened', async () => {
  const controller = new AbortController();
  controller.abort();
  let fetchCalls = 0;
  await assert.rejects(
    () => pullOllamaModel('qwen3.5:2b', () => {}, 'http://127.0.0.1:11434', async () => { fetchCalls++; }, controller.signal),
    /model download cancelled/i
  );
  assert.equal(fetchCalls, 0);
});
