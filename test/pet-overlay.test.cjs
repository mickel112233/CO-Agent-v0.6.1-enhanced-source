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
  assert.match(source, /screenApi\.getDisplayMatching/);
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
  assert.match(app, /sendRef\.current = send/);
  assert.match(app, /busyRef\.current = busy/);
  assert.match(app, /void sendRef\.current\?\.\(text\)/);
  assert.match(app, /markBridgeReady.*catch/);
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
  assert.match(overlay, /flush: \(\) => \{ if \(saveTimer\)/);
});

test('pet overlay restores saved visibility and bounds, clamps display changes, and persists hide/show', async () => {
  const { EventEmitter } = require('node:events');
  const { createPetOverlay } = require('../electron/pet-overlay.cjs');
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'co-agent-pet-behavior-'));
  const prefs = path.join(dir, 'pet-overlay.json');
  fs.writeFileSync(prefs, JSON.stringify({ version: 1, visible: true, bounds: { x: 900, y: 700, width: 340, height: 240 } }));
  const screen = new EventEmitter();
  let display = { id: 1, workArea: { x: 0, y: 0, width: 1000, height: 800 } };
  screen.getPrimaryDisplay = () => display;
  let matchCalls = 0;
  screen.getDisplayMatching = () => { matchCalls++; return display; };
  const windows = [];
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super(); this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height };
      this.visible = false; this.destroyed = false; this.options = options;
      this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = fn => { this.openHandler = fn; };
      this.webContents.send = (...args) => { this.lastSent = args; };
      this.webContents.on = this.webContents.on.bind(this.webContents);
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
    close() { this.destroyed = true; this.emit('closed'); }
    getBounds() { return { ...this.bounds }; }
    setBounds(bounds) { this.bounds = { ...bounds }; }
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    loadFile() { return Promise.resolve(); }
  }
  const app = { getPath: () => dir, isPackaged: false };
  const receivedMessages = [];
  const overlay = createPetOverlay({ app, BrowserWindow: FakeWindow, screen, fs: require('node:fs/promises'), preloadPath: path.join(dir, 'preload.cjs'), onMessage: text => receivedMessages.push(text) });
  try {
    const restored = await overlay.restore();
    assert.equal(restored.visible, true);
    assert.equal(windows.length, 1);
    assert.equal(windows[0].isVisible(), true);
    assert.equal(windows[0].options.webPreferences.sandbox, true);
    assert.equal(windows[0].options.webPreferences.nodeIntegration, false);
    windows[0].bounds = { x: 990, y: 790, width: 340, height: 240 };
    screen.emit('display-removed');
    assert.ok(matchCalls > 0, 'display change must use the injected screen API');
    assert.ok(windows[0].bounds.x + windows[0].bounds.width <= 992);
    assert.ok(windows[0].bounds.y + windows[0].bounds.height <= 792);
    windows[0].webContents.emit('ipc-message', {}, 'pet:message', '  ' + 'x'.repeat(4500) + '  ');
    assert.equal(receivedMessages.length, 1);
    assert.equal(receivedMessages[0].length, 4000);
    assert.ok(!receivedMessages[0].startsWith(' '));
    windows[0].webContents.emit('ipc-message', {}, 'pet:close');
    assert.equal(overlay.isVisible(), false, 'companion close control hides the overlay');
    overlay.show();
    overlay.hide();
    await overlay.flush();
    assert.equal(JSON.parse(fs.readFileSync(prefs, 'utf8')).visible, false);
    overlay.show();
    await overlay.flush();
    assert.equal(JSON.parse(fs.readFileSync(prefs, 'utf8')).visible, true);
    assert.equal(overlay.isVisible(), true);
    overlay.destroy();
    await overlay.flush();
  } finally {
    overlay.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('pet animation frames and upstream license notices exist in the pinned submodule', () => {
  const petRoot = path.join(root, 'integrations', 'AI-Desktop-Pet');
  const assets = path.join(petRoot, 'public', 'assets', 'albedo');
  for (const frame of ['id1_1.png', 'id2_1.png', 'walk1.png', 'walk2.png', 'walk3.png']) {
    assert.ok(fs.statSync(path.join(assets, frame)).isFile(), 'missing pet animation frame ' + frame);
  }
  assert.ok(fs.statSync(path.join(petRoot, 'LICENSE')).isFile(), 'upstream root license is required');
  for (const notice of ['licence.txt', 'originallicense.txt', 'ライセンス.txt']) {
    assert.ok(fs.statSync(path.join(petRoot, 'licenses', notice)).isFile(), 'missing upstream license notice ' + notice);
  }
});
