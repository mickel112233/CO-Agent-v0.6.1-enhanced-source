'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const COMMANDS = Object.freeze({ lint: ['lint'], render: ['render', '--output', 'co-agent-render.mp4'], preview: ['preview'] });
function executableArgs(args) {
  return process.platform === 'win32' ? { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'hyperframes ' + args.join(' ')] } : { file: 'hyperframes', args };
}
async function getStatus() {
  const command = executableArgs(['--version']);
  try {
    const { stdout, stderr } = await execFileAsync(command.file, command.args, { cwd: process.cwd(), windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024 });
    return { available: true, version: String(stdout || stderr || '').trim().split(/\r?\n/)[0], command: 'hyperframes' };
  } catch (error) { return { available: false, version: '', command: 'hyperframes', error: 'Hyperframes CLI was not found or could not run. Install Node.js 22+, FFmpeg, then run: npx hyperframes --help (or install it globally).' }; }
}
async function validateProject(projectDir) {
  if (!projectDir || typeof projectDir !== 'string') throw new Error('Choose a Hyperframes project folder first.');
  const dir = path.resolve(projectDir);
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error('The selected Hyperframes project path is not a folder.');
  const exists = await fs.access(path.join(dir, 'index.html')).then(() => true).catch(() => false);
  if (!exists) throw new Error('This folder does not contain index.html. Open a Hyperframes project folder.');
  return dir;
}
async function runAction(action, projectDir) {
  if (!Object.prototype.hasOwnProperty.call(COMMANDS, action)) throw new Error('Unsupported Hyperframes action. Choose lint, render, or preview.');
  const dir = await validateProject(projectDir);
  const status = await getStatus();
  if (!status.available) throw new Error(status.error);
  const command = executableArgs(COMMANDS[action]);
  if (action === 'preview') {
    const child = spawn(command.file, command.args, { cwd: dir, windowsHide: true, detached: true, stdio: 'ignore' });
    child.on('error', () => {}); child.unref();
    return { ok: true, action, started: true, pid: child.pid || null, message: 'Hyperframes preview was launched. Use its browser window or terminal for status.' };
  }
  try {
    const { stdout, stderr } = await execFileAsync(command.file, command.args, { cwd: dir, windowsHide: true, timeout: action === 'render' ? 30 * 60 * 1000 : 120000, maxBuffer: 4 * 1024 * 1024 });
    return { ok: true, action, output: action === 'render' ? path.join(dir, 'co-agent-render.mp4') : '', message: String(stdout || stderr || (action + ' completed successfully.')).trim().slice(-6000) };
  } catch (error) { throw new Error('Hyperframes ' + action + ' failed: ' + String(error.stderr || error.message || 'Unknown error').slice(-3000)); }
}
module.exports = { getStatus, runAction, validateProject, COMMANDS };
