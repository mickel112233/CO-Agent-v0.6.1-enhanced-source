'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('local and API chat streams flow from provider parser through IPC into the live chat UI', async () => {
  const main = await fs.readFile(path.join(root, 'electron', 'main.cjs'), 'utf8');
  const preload = await fs.readFile(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  const app = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');
  assert.match(main, /require\('\.\/provider-stream\.cjs'\)/);
  assert.match(main, /streamOllamaChat/);
  assert.match(main, /streamProviderChat/);
  assert.match(main, /runtime:chat-chunk/);
  assert.match(main, /payload\?\.stream === true/);
  assert.match(preload, /onChatChunk: callback => subscribe\('runtime:chat-chunk', callback\)/);
  assert.match(app, /onChatChunk\?\./);
  assert.match(app, /stream: true/);
  assert.match(app, /event\.requestId !== activeRequestIdRef\.current/);
  assert.match(app, /streamingText \? <div className="markdown"/);
  assert.match(app, /Generation stopped — showing the partial response/);
});
