'use strict';

const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULTS = Object.freeze({ visible: true, bounds: null });
function clampBounds(bounds, display) {
  const area = display.workArea;
  const width = Math.min(360, Math.max(300, area.width - 24), Math.max(1, Number(bounds?.width) || 340));
  const height = Math.min(250, Math.max(220, area.height - 24), Math.max(1, Number(bounds?.height) || 240));
  const rawX = Number.isFinite(Number(bounds?.x)) ? Number(bounds.x) : area.x + area.width - width - 16;
  const rawY = Number.isFinite(Number(bounds?.y)) ? Number(bounds.y) : area.y + area.height - height - 16;
  const x = Math.min(Math.max(rawX, area.x + 8), area.x + area.width - width - 8);
  const y = Math.min(Math.max(rawY, area.y + 8), area.y + area.height - height - 8);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
function createPetOverlay({ preloadPath, onMessage, onClose, app: appApi = app, BrowserWindow: BrowserWindowApi = BrowserWindow, screen: screenApi = screen, fs: fsApi = fs } = {}) {
  let win = null;
  let enabled = true;
  let destroying = false;
  let preferences = { ...DEFAULTS };
  let writeQueue = Promise.resolve();
  let saveTimer = null;
  const preferencesPath = () => path.join(appApi.getPath('userData'), 'pet-overlay.json');
  async function loadPreferences() {
    try {
      const raw = JSON.parse(await fsApi.readFile(preferencesPath(), 'utf8'));
      const bounds = raw?.bounds;
      const validBounds = bounds && ['x','y','width','height'].every(key => Number.isFinite(Number(bounds[key])));
      preferences = {
        visible: typeof raw?.visible === 'boolean' ? raw.visible : DEFAULTS.visible,
        bounds: validBounds ? { x: Number(bounds.x), y: Number(bounds.y), width: Number(bounds.width), height: Number(bounds.height) } : null
      };
    } catch { preferences = { ...DEFAULTS }; }
    enabled = preferences.visible;
    return preferences;
  }
  function persistPreferences() {
    const snapshot = {
      version: 1,
      visible: !!enabled,
      bounds: win && !win.isDestroyed() ? win.getBounds() : preferences.bounds
    };
    preferences = snapshot;
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const file = preferencesPath();
      await fsApi.mkdir(path.dirname(file), { recursive: true });
      const temp = file + '.tmp-' + process.pid;
      try {
        await fsApi.writeFile(temp, JSON.stringify(snapshot), { encoding: 'utf8', mode: 0o600 });
        await fsApi.rename(temp, file);
      } finally { await fsApi.rm(temp, { force: true }).catch(() => {}); }
    });
    return writeQueue;
  }
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; persistPreferences().catch(() => {}); }, 180);
  }
  function createBounds() {
    const saved = preferences.bounds;
    const display = saved ? screenApi.getDisplayMatching(saved) : screenApi.getPrimaryDisplay();
    return clampBounds(saved || {}, display);
  }
  function show() {
    enabled = true;
    if (win && !win.isDestroyed()) {
      win.showInactive();
      scheduleSave();
      return win;
    }
    const bounds = createBounds();
    destroying = false;
    win = new BrowserWindowApi({
      ...bounds, show: false, frame: false, transparent: true,
      backgroundColor: '#00000000', alwaysOnTop: true, resizable: true,
      skipTaskbar: true, title: 'CO-Agent Pet',
      webPreferences: { preload: preloadPath || path.join(__dirname, 'pet-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('ipc-message', (_event, channel, payload) => {
      if (channel === 'pet:message' && typeof payload === 'string' && payload.trim()) onMessage?.(payload.trim().slice(0, 4000));
      if (channel === 'pet:close') hide();
    });
    win.on('move', scheduleSave);
    win.on('resize', scheduleSave);
    win.on('closed', () => {
      win = null;
      if (!destroying) { enabled = false; persistPreferences().catch(() => {}); }
      onClose?.();
    });
    const assetDir = appApi.isPackaged ? path.join(process.resourcesPath, 'pet-assets', 'albedo') : path.join(__dirname, '..', 'integrations', 'AI-Desktop-Pet', 'public', 'assets', 'albedo');
    const assetRoot = pathToFileURL(assetDir + path.sep).href;
    win.loadFile(path.join(__dirname, 'pet-overlay.html'), { query: { assetRoot } }).then(() => { if (enabled && win && !win.isDestroyed()) win.showInactive(); }).catch(() => {});
    persistPreferences().catch(() => {});
    return win;
  }
  function hide() {
    enabled = false;
    if (win && !win.isDestroyed()) {
      preferences.bounds = win.getBounds();
      win.hide();
    }
    persistPreferences().catch(() => {});
  }
  function toggle() { if (enabled && win && !win.isDestroyed() && win.isVisible()) hide(); else show(); }
  function destroy() {
    destroying = true;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (win && !win.isDestroyed()) {
      preferences.bounds = win.getBounds();
      persistPreferences().catch(() => {});
      win.close();
    }
    win = null;
    return writeQueue;
  }
  function restore() {
    return loadPreferences().then(saved => {
      if (saved.visible) show();
      return { ok: true, visible: !!saved.visible, bounds: saved.bounds };
    });
  }
  function sendStatus(text) { if (win && !win.isDestroyed()) win.webContents.send('pet:status', String(text || '').slice(0, 500)); }
  function isVisible() { return !!enabled && !!win && !win.isDestroyed() && win.isVisible(); }
  const displayChanged = () => {
    if (!win || win.isDestroyed()) return;
    const current = win.getBounds();
    const display = screen.getDisplayMatching(current);
    const safe = clampBounds(current, display);
    if (safe.x !== current.x || safe.y !== current.y || safe.width !== current.width || safe.height !== current.height) win.setBounds(safe);
    scheduleSave();
  };
  screenApi.on('display-metrics-changed', displayChanged);
  screenApi.on('display-removed', displayChanged);
  screenApi.on('display-added', displayChanged);
  return Object.freeze({ show, hide, toggle, destroy, restore, flush: () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; persistPreferences().catch(() => {}); } return writeQueue; }, sendStatus, isVisible, getBounds: () => win && !win.isDestroyed() ? win.getBounds() : preferences.bounds });
}
module.exports = { createPetOverlay, clampBounds };
