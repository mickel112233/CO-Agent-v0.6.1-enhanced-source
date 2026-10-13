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
