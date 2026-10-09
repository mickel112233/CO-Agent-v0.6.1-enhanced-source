'use strict';
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const execFileAsync = promisify(execFile);

const ALLOWED = new Set(['notepad.exe','calc.exe','mspaint.exe','explorer.exe']);
function validateApp(name) {
  const app = String(name || '').toLowerCase();
  if (!ALLOWED.has(app)) throw new Error('Application is not allow-listed: ' + app);
  return app;
}
async function launchApp(name) {
  const app = validateApp(name);
  if (process.platform !== 'win32') throw new Error('Allow-listed app launch is currently supported on Windows only.');
  await execFileAsync('cmd.exe', ['/d','/s','/c','start','""',app], { windowsHide: true, timeout: 5000 });
  return { ok: true, app };
}
async function openPath(input) {
  const p = path.resolve(String(input || ''));
  if (!input || p.length > 2048) throw new Error('A valid path is required.');
  const fs = require('node:fs/promises');
  const stat = await fs.stat(p);
  if (!stat.isDirectory() && !stat.isFile()) throw new Error('Path is not a file or directory.');
  const { shell } = require('electron');
  const error = await shell.openPath(p);
  if (error) throw new Error(error);
  return { ok: true, path: p };
}
module.exports = { launchApp, openPath, allowedApps: [...ALLOWED] };
