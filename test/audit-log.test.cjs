'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createAuditLog, normalizeEvent } = require('../electron/audit-log.cjs');

test('audit events redact prompts, credentials, content, and arguments recursively', () => {
  const event = normalizeEvent({ action: 'mcp.call', status: 'completed', details: { model: 'local', apiKey: 'secret', prompt: 'private prompt', nested: { token: 'bearer', path: 'src/App.jsx', arguments: { command: 'rm -rf' } } } });
  assert.equal(event.details.apiKey, '[redacted]');
  assert.equal(event.details.prompt, '[redacted]');
  assert.equal(event.details.nested.token, '[redacted]');
  assert.equal(event.details.nested.arguments, '[redacted]');
  assert.equal(event.details.nested.path, 'src/App.jsx');
});

test('audit log is serialized, bounded, and returns newest records first', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-audit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const log = createAuditLog(path.join(root, 'audit.jsonl'), { maxEntries: 10, maxBytes: 4096 });
  for (let i = 0; i < 15; i++) await log.append({ action: 'test.event', status: 'completed', target: 'item-' + i, details: { index: i } });
  const events = await log.list(100);
  assert.equal(events.length, 10);
  assert.equal(events[0].target, 'item-14');
  assert.equal(events.at(-1).target, 'item-5');
  const disk = await fs.readFile(path.join(root, 'audit.jsonl'), 'utf8');
  assert.ok(Buffer.byteLength(disk) <= 4096);
  assert.equal(disk.trim().split('\n').length, 10);
});
