'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ReadableStream } = require('node:stream/web');
const { streamProviderChat, streamOllamaChat, consumeStream } = require('../electron/provider-stream.cjs');

function response(lines, status = 200) {
  const chunks = lines.map(line => new TextEncoder().encode(line));
  return { ok: status >= 200 && status < 300, status, text: async () => 'provider error', body: new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }) };
}
test('OpenAI-compatible streaming preserves role history and emits partial chunks', async () => {
  let request;
  const chunks = [];
  const result = await streamProviderChat({ protocol: 'openai', model: 'demo', baseUrl: 'https://example.com/v1' }, 'secret', [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }, { role: 'user', content: 'again' }], chunk => chunks.push(chunk), async (url, options) => {
    request = { url, options };
    return response(['data: {"choices":[{"delta":{"content":"Hel"}}]}\n', 'data: {"choices":[{"delta":{"content":"lo"}}]}\n', 'data: [DONE]\n']);
  });
  assert.equal(result.message, 'Hello');
  assert.deepEqual(chunks, ['Hel', 'lo']);
  const body = JSON.parse(request.options.body);
  assert.equal(body.stream, true);
  assert.deepEqual(body.messages.slice(-3).map(item => item.role), ['user', 'assistant', 'user']);
  assert.equal(request.options.headers.authorization, 'Bearer secret');
});

test('Anthropic and Gemini SSE deltas are decoded', async () => {
  const anthropic = await streamProviderChat({ protocol: 'anthropic', model: 'claude', baseUrl: 'https://api.anthropic.com/v1' }, 'secret', [{ role: 'user', content: 'hi' }], () => {}, async () => response(['event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"A"}}\n', 'data: [DONE]\n']));
  assert.equal(anthropic.message, 'A');
  const gemini = await streamProviderChat({ protocol: 'gemini', model: 'gemini-test', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' }, 'secret', [{ role: 'user', content: 'hi' }], () => {}, async () => response(['data: {"candidates":[{"content":{"parts":[{"text":"G"}]}}]}\n', 'data: [DONE]\n']));
  assert.equal(gemini.message, 'G');
  assert.equal(gemini.interrupted, false);
});

test('Ollama NDJSON streaming emits text and requires a loopback endpoint', async () => {
  const chunks = [];
  const result = await streamOllamaChat('http://127.0.0.1:11434', 'gemma3:4b', [{ role: 'system', content: 'enabled skill context' }, { role: 'user', content: 'hi' }], chunk => chunks.push(chunk), async () => response(['{"message":{"content":"Local "},"done":false}\n', '{"message":{"content":"reply"},"done":true}\n']));
  assert.equal(result.message, 'Local reply');
  assert.deepEqual(chunks, ['Local ', 'reply']);
  await assert.rejects(streamOllamaChat('http://example.com:11434', 'm', [{ role: 'user', content: 'x' }], () => {}, async () => response([])), /loopback/i);
});

test('partial stream is preserved when the reader fails after emitting text', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n')); }, pull(controller) { controller.error(new Error('connection reset')); } });
  const result = await consumeStream({ body: stream }, 'openai', () => {}, new AbortController().signal);
  assert.equal(result.message, 'partial');
  assert.equal(result.interrupted, true);
});

test('streamed provider errors and empty responses are surfaced', async () => {
  await assert.rejects(streamProviderChat({ protocol: 'openai', model: 'demo', baseUrl: 'https://example.com/v1' }, '', [{ role: 'user', content: 'hi' }], () => {}, async () => response([], 429)), /429/);
  await assert.rejects(streamProviderChat({ protocol: 'openai', model: 'demo', baseUrl: 'https://example.com/v1' }, '', [{ role: 'user', content: 'hi' }], () => {}, async () => response(['data: [DONE]\n'])), /empty streamed response/i);
});


test('truncated Ollama stream is marked interrupted instead of silently complete', async () => {
  const result = await streamOllamaChat('http://127.0.0.1:11434', 'gemma3:4b', [{ role: 'user', content: 'hi' }], () => {}, async () => response([
    '{"message":{"content":"partial local response"},"done":false}\n'
  ]));
  assert.equal(result.message, 'partial local response');
  assert.equal(result.interrupted, true);
  assert.match(result.error, /completion marker/i);
});
