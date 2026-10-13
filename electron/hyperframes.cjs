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
function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
async function createComposition({ title = 'CO-Agent composition', description = '', outputDir } = {}) {
  const dir = path.resolve(String(outputDir || ''));
  if (!outputDir || !path.isAbsolute(dir)) throw new Error('Choose an absolute output folder for the Hyperframes composition.');
  const titleText = String(title || '').trim().slice(0, 160);
  const bodyText = String(description || '').trim().slice(0, 4000);
  if (!titleText) throw new Error('Enter a title for the composition.');
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, 'index.html');
  const exists = await fs.access(target).then(() => true).catch(() => false);
  if (exists) throw new Error('The chosen folder already contains index.html. Choose an empty folder so existing work is not overwritten.');
  const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(titleText) + '</title><style>\n*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b14;color:#fff;font-family:Inter,Segoe UI,Arial,sans-serif}.frame{position:relative;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 72% 25%,#47378b 0,transparent 42%),radial-gradient(ellipse at 15% 90%,#0e7184 0,transparent 38%),#090b14}.orb{position:absolute;width:44vw;height:44vw;border-radius:50%;background:linear-gradient(135deg,#b6a0ff88,#2dd4bf22);filter:blur(2px);animation:float 7s ease-in-out infinite alternate}.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff09 1px,transparent 1px),linear-gradient(90deg,#ffffff09 1px,transparent 1px);background-size:4vw 4vw;mask-image:linear-gradient(transparent,#000)}.copy{position:relative;max-width:78vw;padding:6vw;animation:rise 1s ease-out both}.eyebrow{font-size:1.1vw;letter-spacing:.32em;color:#7ee7df;text-transform:uppercase}.title{font-size:7vw;line-height:.98;letter-spacing:-.06em;margin:2vw 0;font-weight:800;text-wrap:balance}.description{font-size:2vw;line-height:1.5;max-width:58vw;color:#d8d9e8;white-space:pre-wrap}.rule{height:.5vw;width:12vw;border-radius:2vw;background:linear-gradient(90deg,#7ee7df,#b6a0ff);margin-top:3vw}@keyframes rise{from{opacity:0;transform:translateY(3vw)}to{opacity:1;transform:translateY(0)}}@keyframes float{from{transform:translate(-8vw,-4vh) scale(.92)}to{transform:translate(8vw,4vh) scale(1.08)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></head><body><main class="frame"><div class="orb"></div><div class="grid"></div><section class="copy"><div class="eyebrow">CO-AGENT · MOTION GRAPHICS</div><h1 class="title">' + escapeHtml(titleText) + '</h1><p class="description">' + escapeHtml(bodyText || 'A cinematic motion-graphics title card, ready for further editing.') + '</p><div class="rule"></div></section></main></body></html>';
  await fs.writeFile(target, html, { flag: 'wx' });
  await fs.writeFile(path.join(dir, 'co-agent-composition.json'), JSON.stringify({ version: 1, title: titleText, description: bodyText, generatedAt: new Date().toISOString(), renderer: 'Hyperframes-compatible HTML composition' }, null, 2), { flag: 'wx' });
  return { ok: true, projectDir: dir, entry: target, message: 'Created a safe, self-contained animated HTML composition. Open it in Hyperframes to lint, preview, and render; the CLI remains optional.' };
}
module.exports = { getStatus, runAction, validateProject, createComposition, escapeHtml, COMMANDS };
