'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');

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
  if (!input || input.length > 500 || input.startsWith('/') || /^[A-Za-z]:/.test(input) || /[\x00-\x1f\x7f]/.test(input)) throw new Error('Use a relative path without control characters inside the selected workspace.');
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
  const requestedMax = Number(options?.maxFiles);
  const maxFiles = Number.isFinite(requestedMax) && requestedMax > 0
    ? Math.max(1, Math.min(2000, Math.floor(requestedMax)))
    : 500;
  // Read one extra eligible file so "truncated" means files were actually omitted,
  // not merely that the workspace happened to contain exactly maxFiles files.
  const scanLimit = maxFiles + 1;
  const results = [];
  async function walk(directory, prefix = '') {
    if (results.length >= scanLimit) return;
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (results.length >= scanLimit) break;
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
  const truncated = results.length > maxFiles;
  if (truncated) results.length = maxFiles;
  return { ok: true, root, files: results, truncated };
}
async function readFile(relativePath) {
  const target = await resolveSafe(relativePath);
  const stat = await fs.stat(target.absolute);
  if (!stat.isFile()) throw new Error('Only files can be read.');
  if (stat.size > MAX_FILE_BYTES) throw new Error('File exceeds the 120 KB agent context limit.');
  const content = await fs.readFile(target.absolute, 'utf8');
  return { ok: true, path: target.relative.split(path.sep).join('/'), content, size: stat.size };
}

function createUnifiedDiff(relativePath, before, after, maxChars = 10000) {
  if (before === after) return { diff: 'No changes: proposed content matches the existing file.', unchanged: true, truncated: false };
  const oldLines = before === '' ? [] : before.replace(/\r\n/g, '\n').split('\n');
  const newLines = after === '' ? [] : after.replace(/\r\n/g, '\n').split('\n');
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const contextBefore = Math.min(3, prefix);
  const start = prefix - contextBefore;
  const oldEnd = oldLines.length - suffix;
  const newEnd = newLines.length - suffix;
  const contextAfter = Math.min(3, suffix);
  const lines = ['--- ' + (oldLines.length ? 'a/' + relativePath : '/dev/null'), '+++ b/' + relativePath];
  const oldCount = Math.max(0, oldEnd - start) + contextAfter;
  const newCount = Math.max(0, newEnd - start) + contextAfter;
  const oldStart = oldLines.length ? start + 1 : 0;
  const newStart = newLines.length ? start + 1 : 0;
  lines.push('@@ -' + oldStart + ',' + oldCount + ' +' + newStart + ',' + newCount + ' @@');
  for (let i = start; i < prefix; i++) lines.push(' ' + oldLines[i]);
  for (let i = prefix; i < oldEnd; i++) lines.push('-' + oldLines[i]);
  for (let i = prefix; i < newEnd; i++) lines.push('+' + newLines[i]);
  for (let i = 0; i < contextAfter; i++) lines.push(' ' + oldLines[oldEnd + i]);
  let diff = lines.join('\n');
  const truncated = diff.length > maxChars;
  if (truncated) diff = diff.slice(0, maxChars) + '\n[Diff preview truncated. The complete proposal remains bounded to 120 KB per file.]';
  return { diff, unchanged: false, truncated };
}
async function previewChanges(payload = {}) {
  if (!Array.isArray(payload.files) || payload.files.length < 1 || payload.files.length > MAX_FILES_PER_CHANGE) throw new Error('Preview between 1 and 12 proposed file changes at a time.');
  let total = 0;
  const files = [];
  for (const item of payload.files) {
    const target = await resolveSafe(item.path, { allowMissing: true });
    const normalizedRelative = target.relative.split(path.sep).join('/');
    if (normalizedRelative.startsWith('.github/workflows/')) throw new Error('Agent writes to GitHub workflow files are blocked; edit workflow security settings manually.');
    if (typeof item.content !== 'string') throw new Error('Each file change must include complete text content.');
    const bytes = Buffer.byteLength(item.content, 'utf8');
    if (bytes > MAX_FILE_BYTES) throw new Error('A proposed file exceeds the 120 KB limit: ' + item.path);
    total += bytes;
    if (total > MAX_CHANGE_BYTES) throw new Error('The complete change set exceeds 600 KB.');
    const existing = await fs.lstat(target.absolute).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error('Only regular files can be previewed: ' + item.path);
    let before = '';
    if (existing) {
      const stat = await fs.stat(target.absolute);
      if (stat.size > MAX_FILE_BYTES) throw new Error('Existing file exceeds the 120 KB diff preview limit: ' + item.path);
      before = await fs.readFile(target.absolute, 'utf8');
      if (before.includes('\0')) throw new Error('Binary files cannot be previewed as text: ' + item.path);
    }
    const diff = !existing && item.content === '' ? { diff: '--- /dev/null\n+++ b/' + normalizedRelative + '\n@@ -0,0 +0,0 @@', unchanged: false, truncated: false } : createUnifiedDiff(normalizedRelative, before, item.content);
    files.push({ path: normalizedRelative, created: !existing, exists: !!existing, beforeHash: existing ? createHash('sha256').update(before, 'utf8').digest('hex') : null, oldBytes: Buffer.byteLength(before, 'utf8'), newBytes: bytes, oldLines: before === '' ? 0 : before.split(/\r?\n/).length, newLines: item.content === '' ? 0 : item.content.split(/\r?\n/).length, ...diff });
  }
  return { ok: true, files };
}

async function applyChanges(payload = {}) {
  if (payload.approved !== true) throw new Error('File changes require explicit user approval.');
  if (!Array.isArray(payload.files) || payload.files.length < 1 || payload.files.length > MAX_FILES_PER_CHANGE) throw new Error('Approve between 1 and 12 file changes at a time.');
  const prepared = [];
  const seenPaths = new Set();
  let total = 0;
  for (const item of payload.files) {
    const target = await resolveSafe(item.path, { allowMissing: true });
    const normalizedRelative = target.relative.split(path.sep).join('/');
    if (normalizedRelative.startsWith('.github/workflows/')) throw new Error('Agent writes to GitHub workflow files are blocked; edit workflow security settings manually.');
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
    if (typeof item.expectedExists === 'boolean' && item.expectedExists !== !!existing) throw new Error('File changed after review; preview it again before applying: ' + item.path);
    let currentHash = null;
    if (existing && typeof item.expectedBeforeHash === 'string') {
      const currentContent = await fs.readFile(target.absolute, 'utf8');
      currentHash = createHash('sha256').update(currentContent, 'utf8').digest('hex');
      if (currentHash !== item.expectedBeforeHash) throw new Error('File changed after review; preview it again before applying: ' + item.path);
    }
    prepared.push({ ...target, content: item.content, bytes, existed: !!existing, expectedBeforeHash: item.expectedBeforeHash, expectedExists: item.expectedExists });
  }
  const backupRoot = path.join(getRoot(), '.co-agent-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  const backupPaths = new Map();
  const attempted = [];
  const applied = [];
  try {
    // Back up every existing target before changing any target, so a backup failure
    // cannot leave a partially-applied multi-file proposal.
    for (const item of prepared) {
      if (!item.existed) continue;
      const backup = path.join(backupRoot, item.relative);
      await fs.mkdir(path.dirname(backup), { recursive: true });
      await fs.writeFile(backup, await fs.readFile(item.absolute), { flag: 'wx' });
      backupPaths.set(item.relative, backup);
    }
    for (const item of prepared) {
      if (typeof item.expectedExists === 'boolean') {
        const current = await fs.lstat(item.absolute).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
        if (!!current !== item.expectedExists) throw new Error('File changed after review; preview it again before applying: ' + item.relative);
        if (current && typeof item.expectedBeforeHash === 'string') {
          const currentContent = await fs.readFile(item.absolute, 'utf8');
          if (createHash('sha256').update(currentContent, 'utf8').digest('hex') !== item.expectedBeforeHash) throw new Error('File changed after review; preview it again before applying: ' + item.relative);
        }
      }
      await fs.mkdir(path.dirname(item.absolute), { recursive: true });
      // Track before writing: a failed write can still truncate/create a partial file.
      attempted.push(item);
      await fs.writeFile(item.absolute, item.content, { encoding: 'utf8', flag: item.existed ? 'w' : 'wx' });
      const written = await fs.readFile(item.absolute, 'utf8');
      const expectedHash = createHash('sha256').update(item.content, 'utf8').digest('hex');
      const actualHash = createHash('sha256').update(written, 'utf8').digest('hex');
      if (actualHash !== expectedHash) throw new Error('Post-write verification failed for ' + item.relative + '; the file contents do not match the approved proposal.');
      applied.push({ path: item.relative.split(path.sep).join('/'), bytes: item.bytes, created: !item.existed, sha256: actualHash, verified: true });
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const item of attempted.reverse()) {
      try {
        if (item.existed) await fs.writeFile(item.absolute, await fs.readFile(backupPaths.get(item.relative)));
        else await fs.rm(item.absolute, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(item.relative + ': ' + (rollbackError.message || String(rollbackError)));
      }
    }
    const rollbackMessage = rollbackErrors.length
      ? ' Rollback was incomplete: ' + rollbackErrors.join('; ') + '. Recovery copies, when created, are under .co-agent-backups.'
      : ' All attempted file writes were rolled back.';
    throw new Error('File changes failed after ' + applied.length + ' completed file(s): ' + error.message + '.' + rollbackMessage);
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
module.exports = { setRoot, getRoot, listFiles, readFile, previewChanges, createUnifiedDiff, applyChanges, safeRelativePath, commandList, runCommand, cancelCommand, MAX_FILE_BYTES, MAX_CHANGE_BYTES, MAX_FILES_PER_CHANGE };
