const test = require('node:test');
const assert = require('node:assert/strict');
const { isTrustedRendererUrl } = require('../electron/security.cjs');

test('development renderer trust is limited to the configured loopback origin', () => {
  const options = { isDev: true };
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173/', options), true);
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173/src/main.jsx', options), true);
  assert.equal(isTrustedRendererUrl('https://127.0.0.1:5173/', options), false);
  assert.equal(isTrustedRendererUrl('http://localhost:5173/', options), false);
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5174/', options), false);
  assert.equal(isTrustedRendererUrl('http://user@127.0.0.1:5173/', options), false);
});

test('packaged renderer trust allows only the bundled index document', () => {
  const options = { isDev: false, appUrl: 'file:///C:/CO-Agent/dist/index.html' };
  assert.equal(isTrustedRendererUrl('file:///C:/CO-Agent/dist/index.html', options), true);
  assert.equal(isTrustedRendererUrl('file:///C:/CO-Agent/dist/index.html#/agents', options), true);
  assert.equal(isTrustedRendererUrl('file:///C:/CO-Agent/dist/index.html?view=chat', options), true);
  assert.equal(isTrustedRendererUrl('file:///C:/CO-Agent/secret.txt', options), false);
  assert.equal(isTrustedRendererUrl('https://example.com/', options), false);
  assert.equal(isTrustedRendererUrl('javascript:alert(1)', options), false);
  assert.equal(isTrustedRendererUrl('not a url', options), false);
});

test('computer-use screenshot endpoint must be loopback only', () => {
  const { isLoopbackHttpUrl } = require('../electron/security.cjs');
  assert.equal(isLoopbackHttpUrl('http://127.0.0.1:11434'), true);
  assert.equal(isLoopbackHttpUrl('http://localhost:11434/'), true);
  assert.equal(isLoopbackHttpUrl('http://[::1]:11434'), true);
  assert.equal(isLoopbackHttpUrl('https://example.com/ollama'), false);
  assert.equal(isLoopbackHttpUrl('http://192.168.1.20:11434'), false);
  assert.equal(isLoopbackHttpUrl('http://user@127.0.0.1:11434'), false);
  assert.equal(isLoopbackHttpUrl('not a URL'), false);
});
