const test = require('node:test');
const assert = require('node:assert/strict');
const { readOnlySubagent, allocateSubagentTasks } = require('../electron/agent-runtime.cjs');

const agent = { name: 'Reviewer', instructions: 'Focus on risks.' };
const task = { title: 'Check design', prompt: 'Review the supplied summary.' };
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('subagent budget is shared across the parent run and caps delegation at three', () => {
  const context = { remainingSubagents: 3 };
  assert.equal(allocateSubagentTasks(context, [task, task, task, task]).length, 3);
  assert.equal(context.remainingSubagents, 0);
  assert.deepEqual(allocateSubagentTasks(context, [task]), []);
});

test('OpenAI-compatible child request is a separate read-only call with no tools or key for local providers', async () => {
  let captured;
  const result = await readOnlySubagent({ protocol: 'openai', baseUrl: 'http://127.0.0.1:1234/v1', model: 'tiny-local' }, '', agent, task, async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return jsonResponse({ choices: [{ message: { content: 'Independent result.' } }] });
  });
  assert.equal(result, 'Independent result.');
  assert.equal(captured.url, 'http://127.0.0.1:1234/v1/chat/completions');
  assert.equal(captured.body.model, 'tiny-local');
  assert.equal(captured.body.messages[0].role, 'system');
  assert.match(captured.body.messages[0].content, /cannot browse the web, read workspace files, call tools/i);
  assert.equal(Object.hasOwn(captured.body, 'tools'), false);
  assert.equal(captured.init.headers.authorization, undefined);
});

test('Anthropic child request omits tools and returns only its text blocks', async () => {
  let captured;
  const result = await readOnlySubagent({ protocol: 'anthropic', baseUrl: 'https://api.example.test/v1', model: 'claude-test' }, 'test-key', agent, task, async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return jsonResponse({ content: [{ type: 'text', text: 'Child analysis.' }] });
  });
  assert.equal(result, 'Child analysis.');
  assert.equal(captured.url, 'https://api.example.test/v1/messages');
  assert.equal(captured.init.headers['x-api-key'], 'test-key');
  assert.equal(Object.hasOwn(captured.body, 'tools'), false);
});

test('Gemini child request uses a separate prompt without function declarations', async () => {
  let captured;
  const result = await readOnlySubagent({ protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-test' }, 'secret', agent, task, async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return jsonResponse({ candidates: [{ content: { parts: [{ text: 'Gemini child result.' }] } }] });
  });
  assert.equal(result, 'Gemini child result.');
  assert.match(captured.url, /:generateContent\?key=secret$/);
  assert.equal(Object.hasOwn(captured.body, 'tools'), false);
});

test('API provider configuration validates model, key, and secure endpoint', () => {
  const { validateProvider } = require('../electron/agent-runtime.cjs');
  assert.equal(validateProvider({ protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: ' gpt-4o-mini ' }, 'secret').model, 'gpt-4o-mini');
  assert.throws(() => validateProvider({ protocol: 'openai', baseUrl: 'http://example.com/v1', model: 'model' }, 'key'), /HTTPS/i);
  assert.throws(() => validateProvider({ protocol: 'openai', baseUrl: 'https://user:pass@example.com/v1', model: 'model' }, 'key'), /credentials/i);
  assert.throws(() => validateProvider({ protocol: 'openai', baseUrl: 'https://example.com/v1?token=x', model: 'model' }, 'key'), /query/i);
  assert.throws(() => validateProvider({ protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude' }, ''), /API key/i);
  assert.throws(() => validateProvider({ protocol: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: '' }, 'key'), /model name/i);
  assert.doesNotThrow(() => validateProvider({ protocol: 'openai', baseUrl: 'http://127.0.0.1:1234/v1', model: 'local-model' }, ''));
});
