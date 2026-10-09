const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 860,
    minHeight: 600,
    title: 'CO-Agent',
    backgroundColor: '#f8f8f6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
  if (isDev) {
    mainWindow.loadURL(devUrl).catch(err => {
      console.error('Could not load Vite renderer:', err);
    });
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error('Renderer load failed:', { code, description, url });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).catch(err => {
      console.error('Could not load packaged renderer:', err);
    });
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
