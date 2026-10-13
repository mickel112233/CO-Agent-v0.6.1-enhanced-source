'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { askLocal } = require('../electron/agent-orchestrator.cjs');

test('local agent model request propagates user cancellation to fetch', async () => {
  const originalFetch = global.fetch;
  const controller = new AbortController();
  global.fetch = async (_url, options) => new Promise((resolve, reject) => {
    if (options.signal.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  });
  try {
    const pending = askLocal({ status: { baseUrl: 'http://127.0.0.1:11434' }, model: 'test-model' }, [{ role: 'user', content: 'test' }], { signal: controller.signal, timeoutMs: 10000 });
    controller.abort();
    await assert.rejects(pending, /aborted/i);
  } finally { global.fetch = originalFetch; }
});

test('workflow steps propagate cancellation to the model call and recover running steps after restart', async () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const main = await fs.readFile(path.join(root, 'electron', 'main.cjs'), 'utf8');
  const orchestrator = await fs.readFile(path.join(root, 'electron', 'agent-orchestrator.cjs'), 'utf8');
  const preload = await fs.readFile(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  const agents = await fs.readFile(path.join(root, 'src', 'Agents.jsx'), 'utf8');
  assert.match(main, /activeAgentStepRequests/);
  assert.match(main, /agents:cancel-step/);
  assert.match(orchestrator, /signal:options\.signal/);
  assert.match(preload, /cancelStep: invoke\('agents:cancel-step'\)/);
  assert.match(agents, /Interrupted steps were reset to queued after restart/);
  assert.match(agents, /Cancel step/);
  assert.match(agents, /status: cancelled \? 'queued' : 'blocked'/);
});
