const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const attachments = require('../electron/text-attachments.cjs');

test('reads bounded text attachments with safe display names', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-attachments-'));
  try {
    const file = path.join(dir, 'notes.md');
    await fs.writeFile(file, '# Notes\nhello', 'utf8');
    const result = await attachments.readTextAttachments([file]);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'notes.md');
    assert.match(result[0].content, /hello/);
    assert.equal(result[0].size, Buffer.byteLength('# Notes\nhello'));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('rejects unsupported, binary, oversized, and excessive text attachments', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-attachments-'));
  try {
    const image = path.join(dir, 'photo.png');
    await fs.writeFile(image, Buffer.from([1, 2, 3]));
    await assert.rejects(() => attachments.readTextAttachments([image]), /unsupported text attachment/i);
    const binary = path.join(dir, 'binary.txt');
    await fs.writeFile(binary, Buffer.from([65, 0, 66]));
    await assert.rejects(() => attachments.readTextAttachments([binary]), /binary data/i);
    const large = path.join(dir, 'large.txt');
    await fs.writeFile(large, 'x'.repeat(attachments.MAX_FILE_BYTES + 1));
    await assert.rejects(() => attachments.readTextAttachments([large]), /8 KB/i);
    await assert.rejects(() => attachments.readTextAttachments(Array(attachments.MAX_FILES + 1).fill(binary)), /at most 8/i);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('rejects control characters in selected paths', async () => {
  await assert.rejects(() => attachments.readTextAttachments(['bad\npath.txt']), /invalid/i);
});
