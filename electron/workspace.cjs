'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const MAX_FILE_BYTES = 120_000;
const MAX_CHANGE_BYTES = 600_000;
const MAX_FILES_PER_CHANGE = 12;
const MAX_OUTPUT_BYTES = 1_000_000;
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'release', '.co-agent-backups', '.next', 'coverage', '.cache']);
const BLOCKED_NAMES = new Set(['id_rsa', 'id_ed25519', 'credentials.json', 'secrets.json']);
function isBlockedName(name) {
  const lower = String(name || '').toLowerCase();
  return BLOCKED_NAMES.has(lower) || lower.startsWith('.env') || ['.pem', '.key', '.p12', '.pfx', '.secret'].some(ext => lower.endsWith(ext)) || /credential|password|secret|token/.test(lower);
}
const COMMANDS = Object.freeze({
  'npm-test': { label: 'Run tests', executable: 'npm', args: ['test'], windows: 'npm test', timeoutMs: 600_000 },
  'npm-build': { label: 'Build renderer', executable: 'npm', args: ['run', 'build'], windows: 'npm run build', timeoutMs: 600_000 },
  'git-status': { label: 'Git status', executable: 'git', args: ['status', '--short', '--branch'], windows: 'git status --short --branch', timeoutMs: 30_000 },
  'git-diff-check': { label: 'Check diff whitespace', executable: 'git', args: ['diff', '--check'], windows: 'git diff --check', timeoutMs: 30_000 },
  'npm-audit': { label: 'Dependency audit (network)', executable: 'npm', args: ['audit', '--omit=dev'], windows: 'npm audit --omit=dev', timeoutMs: 180_000 }
});

let workspaceRoot = '';
let activeProcess = null;

function normalizeRoot(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Choose a workspace folder first.');
  return path.resolve(value);
}
function getRoot() {
  if (!workspaceRoot) throw new Error('Choose a workspace folder first.');
  return workspaceRoot;
}
async function setRoot(value) {
  const root = normalizeRoot(value);
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) throw new Error('Workspace path must be a directory.');
  workspaceRoot = root;
  return { ok: true, root: workspaceRoot, platform: process.platform };
}
function safeRelativePath(value) {
  const input = String(value || '').replace(/\\/g, '/');
  if (!input || input.length > 500 || input.startsWith('/') || /^[A-Za-z]:/.test(input) || input.includes('\0')) throw new Error('Use a relative path inside the selected workspace.');
  const parts = input.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Path traversal is not allowed.');
  if (parts.some(part => IGNORED_DIRS.has(part) || isBlockedName(part))) throw new Error('This path is blocked from the agent workspace.');
  return parts.join(path.sep);
}
async function resolveSafe(value, { allowMissing = false } = {}) {
  const root = getRoot();
  const relative = safeRelativePath(value);
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) throw new Error('Path escapes the selected workspace.');
  let cursor = root;
  const parts = relative.split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not allowed in agent file operations.');
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('A parent path component is not a directory.');
    } catch (error) {
      if (error.code === 'ENOENT' && allowMissing) break;
      throw error;
    }
  }
  return { root, relative, absolute };
}
async function listFiles(options = {}) {
  const root = getRoot();
  const maxFiles = Math.max(1, Math.min(2000, Number(options.maxFiles) || 500));
  const results = [];
  async function walk(directory, prefix = '') {
    if (results.length >= maxFiles) return;
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      if (entry.name.startsWith('.co-agent-backups') || IGNORED_DIRS.has(entry.name) || isBlockedName(entry.name)) continue;
      const relative = prefix ? prefix + '/' + entry.name : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(absolute, relative);
      else if (entry.isFile()) {
        try { const stat = await fs.stat(absolute); results.push({ path: relative, size: stat.size, extension: path.extname(entry.name).toLowerCase() }); } catch {}
      }
    }
  }
  await walk(root);
  return { ok: true, root, files: results, truncated: results.length >= maxFiles };
}
async function readFile(relativePath) {
  const target = await resolveSafe(relativePath);
  const stat = await fs.stat(target.absolute);
  if (!stat.isFile()) throw new Error('Only files can be read.');
  if (stat.size > MAX_FILE_BYTES) throw new Error('File exceeds the 120 KB agent context limit.');
  const content = await fs.readFile(target.absolute, 'utf8');
  return { ok: true, path: target.relative.split(path.sep).join('/'), content, size: stat.size };
}
async function applyChanges(payload = {}) {
  if (payload.approved !== true) throw new Error('File changes require explicit user approval.');
  if (!Array.isArray(payload.files) || payload.files.length < 1 || payload.files.length > MAX_FILES_PER_CHANGE) throw new Error('Approve between 1 and 12 file changes at a time.');
  const prepared = [];
  const seenPaths = new Set();
  let total = 0;
  for (const item of payload.files) {
    const target = await resolveSafe(item.path, { allowMissing: true });
    const pathKey = process.platform === 'win32' ? target.relative.toLowerCase() : target.relative;
    if (seenPaths.has(pathKey)) throw new Error('Duplicate file path in the proposed change set: ' + item.path);
    seenPaths.add(pathKey);
    if (typeof item.content !== 'string') throw new Error('Each file change must include complete text content.');
    const bytes = Buffer.byteLength(item.content, 'utf8');
    if (bytes > MAX_FILE_BYTES) throw new Error('A changed file exceeds the 120 KB limit: ' + item.path);
    total += bytes;
    if (total > MAX_CHANGE_BYTES) throw new Error('The complete change set exceeds 600 KB.');
    const existing = await fs.lstat(target.absolute).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error('Only regular files can be replaced: ' + item.path);
    prepared.push({ ...target, content: item.content, bytes, existed: !!existing });
  }
  const backupRoot = path.join(getRoot(), '.co-agent-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  const applied = [];
  try {
    for (const item of prepared) {
      await fs.mkdir(path.dirname(item.absolute), { recursive: true });
      if (item.existed) {
        const oldContent = await fs.readFile(item.absolute);
        const backup = path.join(backupRoot, item.relative);
        await fs.mkdir(path.dirname(backup), { recursive: true });
        await fs.writeFile(backup, oldContent, { flag: 'wx' });
      }
      await fs.writeFile(item.absolute, item.content, { encoding: 'utf8', flag: item.existed ? 'w' : 'wx' });
      applied.push({ path: item.relative.split(path.sep).join('/'), bytes: item.bytes, created: !item.existed });
    }
  } catch (error) {
    throw new Error('File changes stopped after ' + applied.length + ' file(s): ' + error.message + (applied.length ? '. Review .co-agent-backups in the workspace before continuing.' : ''));
  }
  return { ok: true, applied, backupDirectory: backupRoot };
}
function commandList() {
  return Object.entries(COMMANDS).map(([id, item]) => ({ id, label: item.label, command: item.windows && process.platform === 'win32' ? item.windows : item.executable + ' ' + item.args.join(' ') }));
}
function runCommand(id, onOutput = () => {}) {
  if (activeProcess) throw new Error('A terminal command is already running. Wait for it to finish or stop it.');
  const spec = COMMANDS[String(id || '')];
  if (!spec) throw new Error('Command is not in the approved terminal command list.');
  const cwd = getRoot();
  const runId = randomUUID();
  const windows = process.platform === 'win32';
  const child = windows
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', spec.windows], { cwd, windowsHide: true, shell: false, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } })
    : spawn(spec.executable, spec.args, { cwd, windowsHide: true, shell: false, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });
  activeProcess = { runId, child, kill: () => child.kill('SIGTERM') };
  let outputBytes = 0;
  let output = '';
  let timedOut = false;
  let settled = false;
  return new Promise((resolve, reject) => {
    const append = (stream, chunk) => {
      const text = String(chunk);
      const bytes = Buffer.byteLength(text);
      outputBytes += bytes;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        const remaining = Math.max(0, MAX_OUTPUT_BYTES - (outputBytes - bytes));
        const clipped = Buffer.from(text).subarray(0, remaining).toString('utf8');
        output += clipped;
        onOutput({ runId, stream, text: clipped });
        child.kill();
        return;
      }
      output += text;
      onOutput({ runId, stream, text });
    };
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, spec.timeoutMs);
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeProcess = null;
      resolve({ ok: code === 0 && !timedOut, runId, command: id, label: spec.label, cwd, exitCode: code, signal, timedOut, output, truncated: outputBytes > MAX_OUTPUT_BYTES });
    };
    child.stdout.on('data', chunk => append('stdout', chunk));
    child.stderr.on('data', chunk => append('stderr', chunk));
    child.on('error', error => {
      if (settled) return;
      settled = true; clearTimeout(timer); activeProcess = null; reject(error);
    });
    child.on('close', finish);
  });
}
function cancelCommand() {
  if (!activeProcess) return { ok: false, error: 'No terminal command is running.' };
  const runId = activeProcess.runId;
  try { activeProcess.kill(); return { ok: true, runId }; }
  catch (error) { return { ok: false, error: error.message || String(error) }; }
}
module.exports = { setRoot, getRoot, listFiles, readFile, applyChanges, safeRelativePath, commandList, runCommand, cancelCommand, MAX_FILE_BYTES, MAX_CHANGE_BYTES, MAX_FILES_PER_CHANGE };
