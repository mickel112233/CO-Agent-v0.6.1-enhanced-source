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

test('workflow-step cancellation reaches the active Ollama model request', async () => {
  const { runWorkflowStep } = require('../electron/agent-orchestrator.cjs');
  const originalFetch = global.fetch;
  const controller = new AbortController();
  let chatStartedResolve;
  const chatStarted = new Promise(resolve => { chatStartedResolve = resolve; });
  global.fetch = async (url, options = {}) => {
    if (url.endsWith('/api/version')) return new Response(JSON.stringify({ version: '0.1.0' }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: 'qwen3.5:2b' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/api/chat')) {
      chatStartedResolve(options.signal);
      return new Promise((resolve, reject) => {
        if (options.signal.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      });
    }
    throw new Error('Unexpected URL in cancellation fixture: ' + url);
  };
  try {
    const pending = runWorkflowStep({
      goal: 'Review this project safely',
      step: { id: 'step-1', title: 'Review', role: 'planner', skill: 'planner', description: 'Plan the review', deliverable: 'A review plan', acceptanceCriteria: [] },
      model: 'qwen3.5:2b'
    }, controller.signal);
    const activeSignal = await chatStarted;
    assert.equal(activeSignal.aborted, false);
    controller.abort();
    await assert.rejects(pending, /Agent step cancelled by user/i);
    assert.equal(activeSignal.aborted, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test('agent-step cancellation is exposed through validated request-scoped IPC and the UI', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src', 'Agents.jsx'), 'utf8');
  assert.match(main, /activeAgentRuns = new Map\(\)/);
  assert.match(main, /handle\('agents:run-step-cancel'/);
  assert.match(main, /Agent step request ID is missing or invalid/);
  assert.match(preload, /cancelStep: invoke\('agents:run-step-cancel'\)/);
  assert.match(ui, /Cancel agent/);
  assert.match(ui, /desktop\.agents\.cancelStep\(requestId\)/);
});
