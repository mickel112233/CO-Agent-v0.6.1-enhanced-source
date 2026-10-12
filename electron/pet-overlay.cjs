'use strict';

const { BrowserWindow, screen } = require('electron');
const path = require('node:path');

function createPetOverlay({ preloadPath, onMessage, onClose } = {}) {
  let win = null;
  let enabled = true;
  const boundsFor = display => {
    const area = display.workArea;
    const width = Math.min(300, Math.max(240, area.width - 24));
    const height = Math.min(170, Math.max(140, area.height - 24));
    return { x: area.x + area.width - width - 16, y: area.y + area.height - height - 16, width, height };
  };
  function show() {
    enabled = true;
    if (win && !win.isDestroyed()) { win.showInactive(); return win; }
    const display = screen.getPrimaryDisplay();
    win = new BrowserWindow({
      ...boundsFor(display), show: false, frame: false, transparent: true,
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
    win.on('closed', () => { win = null; onClose?.(); });
    win.loadFile(path.join(__dirname, 'pet-overlay.html')).then(() => { if (win && !win.isDestroyed()) win.showInactive(); }).catch(() => {});
    return win;
  }
  function hide() { enabled = false; if (win && !win.isDestroyed()) win.hide(); }
  function toggle() { if (enabled && win && !win.isDestroyed() && win.isVisible()) hide(); else show(); }
  function destroy() { if (win && !win.isDestroyed()) win.close(); win = null; }
  function sendStatus(text) { if (win && !win.isDestroyed()) win.webContents.send('pet:status', String(text || '').slice(0, 500)); }
  return Object.freeze({ show, hide, toggle, destroy, sendStatus, isVisible: () => !!win && !win.isDestroyed() && win.isVisible() });
}
module.exports = { createPetOverlay };
