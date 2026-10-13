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
  assert.match(ui, /Your message opens in CO-Agent chat/);
});

test('main process wires pet messages into the primary renderer and exposes controls', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'App.jsx'), 'utf8');
  assert.match(main, /createPetOverlay/);
  assert.match(main, /pet:incoming-message/);
  assert.match(main, /handle\('pet:show-overlay'/);
  assert.match(preload, /onIncomingMessage/);
  assert.match(app, /desktop\?\.pet\?\.onIncomingMessage/);
});


test('pet overlay persists visibility and bounds and restores safely after restart', () => {
  const source = fs.readFileSync(path.join(root, 'electron', 'pet-overlay.cjs'), 'utf8');
  assert.match(source, /pet-overlay\.json/);
  assert.match(source, /persistPreferences/);
  assert.match(source, /async function loadPreferences/);
  assert.match(source, /function restore\(\)/);
  assert.match(source, /screen\.getDisplayMatching/);
  assert.match(source, /display-metrics-changed/);
  assert.match(source, /display-removed/);
  assert.match(source, /clampBounds/);
});

test('pet requests queue during renderer startup and bridge readiness drains the queue', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src', 'App.jsx'), 'utf8');
  assert.match(main, /pendingPetMessages/);
  assert.match(main, /petMessageBridgeReady/);
  assert.match(main, /handle\('pet:bridge-ready'/);
  assert.match(main, /pendingPetMessages\.splice\(0, pendingPetMessages\.length\)/);
  assert.match(preload, /markBridgeReady: invoke\('pet:bridge-ready'\)/);
  assert.match(app, /markBridgeReady/);
  assert.match(app, /Subscribe before acknowledging readiness/);
});


test('main window close hides to tray and tray exposes app and companion controls', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8');
  assert.match(main, /function createTray\(\)/);
  assert.match(main, /new Tray\(icon\)/);
  assert.match(main, /Open CO-Agent/);
  assert.match(main, /Show companion/);
  assert.match(main, /Hide companion/);
  assert.match(main, /Quit CO-Agent/);
  assert.match(main, /mainWindow\.on\('close', event => \{ if \(!isQuitting\)/);
  assert.match(main, /tray\.destroy\(\)/);
});


test('application waits for companion preferences to flush before final quit', () => {
  const main = fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8');
  const overlay = fs.readFileSync(path.join(root, 'electron', 'pet-overlay.cjs'), 'utf8');
  assert.match(main, /event\.preventDefault\(\);\s*isQuitting = true/);
  assert.match(main, /petOverlay\?\.flush\?\.\(\)/);
  assert.match(overlay, /flush: \(\) => writeQueue/);
});
