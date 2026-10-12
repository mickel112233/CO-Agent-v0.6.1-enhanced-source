'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('pet overlay uses an isolated sandboxed preload and transparent window', () => {
  const source = fs.readFileSync(path.join(root, 'electron', 'pet-overlay.cjs'), 'utf8');
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /sandbox:\s*true/);
  assert.match(source, /transparent:\s*true/);
  assert.match(source, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
  assert.match(source, /will-navigate/);
});

test('pet messages are bounded and exposed only through a narrow bridge', () => {
  const manager = fs.readFileSync(path.join(root, 'electron', 'pet-overlay.cjs'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron', 'pet-preload.cjs'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'electron', 'pet-overlay.html'), 'utf8');
  assert.match(manager, /payload\.trim\(\)\.slice\(0, 4000\)/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('coAgentPet'/);
  assert.match(preload, /text\.trim\(\)\.slice\(0, 4000\)/);
  assert.doesNotMatch(preload, /require\(['"]node:|require\(['"]fs/);
  assert.match(ui, /Tasks are handled in CO-Agent chat/);
});

test('main process wires pet messages into the primary renderer and exposes controls', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'App.jsx'), 'utf8');
  assert.match(main, /createPetOverlay/);
  assert.match(main, /pet:incoming-message/);
  assert.match(main, /handle\('pet:show'/);
  assert.match(preload, /onIncomingMessage/);
  assert.match(app, /desktop\?\.pet\?\.onIncomingMessage/);
});
