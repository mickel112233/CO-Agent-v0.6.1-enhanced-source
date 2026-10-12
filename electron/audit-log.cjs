'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_ENTRIES = 1000;
const MAX_BYTES = 2 * 1024 * 1024;
const SENSITIVE_KEY = /(?:api.?key|secret|password|authorization|token|prompt|content|arguments|base64|image|credential|private.?key)/i;

function clean(value, max = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}
function sanitize(value, key = '', depth = 0) {
  if (SENSITIVE_KEY.test(key)) return '[redacted]';
  if (depth > 5) return '[depth-limited]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return clean(value, 600);
  if (Array.isArray(value)) return value.slice(0, 25).map(item => sanitize(item, '', depth + 1));
  if (typeof value === 'object') {
    const output = {};
    for (const [name, item] of Object.entries(value).slice(0, 40)) output[clean(name, 80)] = sanitize(item, name, depth + 1);
    return output;
  }
  return clean(value, 200);
}
function normalizeEvent(event = {}) {
  const action = clean(event.action, 100);
  const status = clean(event.status, 40);
  if (!action || !status) throw new Error('Audit events require an action and status.');
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    status,
    target: clean(event.target, 300),
    details: sanitize(event.details || {})
  };
}
function createAuditLog(file, options = {}) {
  const io = options.fs || fs;
  const maxEntries = Math.max(10, Math.min(MAX_ENTRIES, Number(options.maxEntries) || MAX_ENTRIES));
  const maxBytes = Math.max(4096, Math.min(MAX_BYTES, Number(options.maxBytes) || MAX_BYTES));
  let queue = Promise.resolve();
  async function readLines() {
    const content = await io.readFile(file, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
    return content.split(/\r?\n/).filter(Boolean);
  }
  async function append(event) {
    const record = normalizeEvent(event);
    const operation = queue.catch(() => {}).then(async () => {
      await io.mkdir(path.dirname(file), { recursive: true });
      const lines = await readLines();
      lines.push(JSON.stringify(record));
      while (lines.length > maxEntries || Buffer.byteLength(lines.join('\n') + '\n', 'utf8') > maxBytes) {
        if (lines.length <= 1) throw new Error('Audit record exceeds the audit log size limit.');
        lines.shift();
      }
      const temp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(5).toString('hex');
      try {
        await io.writeFile(temp, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
        await io.rename(temp, file);
      } finally { await io.rm(temp, { force: true }).catch(() => {}); }
      return record;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  async function list(limit = 100) {
    await queue.catch(() => {});
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    const lines = await readLines();
    return lines.slice(-safeLimit).reverse().flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  }
  return Object.freeze({ append, list });
}
module.exports = { createAuditLog, normalizeEvent, sanitize, MAX_ENTRIES, MAX_BYTES };
