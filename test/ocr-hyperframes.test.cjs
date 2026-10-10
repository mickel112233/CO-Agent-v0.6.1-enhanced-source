const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const ocr = require('../electron/ocr.cjs');
const hyperframes = require('../electron/hyperframes.cjs');

test('OCR rejects unsupported file extensions before invoking an external binary', async () => {
  await assert.rejects(() => ocr.recognizeImage('notes.txt'), /supports PNG, JPEG, TIFF, BMP, and WebP/);
});
test('OCR language option is constrained to a safe language identifier', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-ocr-'));
  const file = path.join(dir, 'test.png');
  await fs.writeFile(file, 'not a real image');
  try { await assert.rejects(() => ocr.recognizeImage(file, 'eng; echo unsafe'), /Invalid OCR language code/); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('Hyperframes only exposes the three supported CLI actions', () => {
  assert.deepEqual(Object.keys(hyperframes.COMMANDS).sort(), ['lint', 'preview', 'render']);
  assert.equal(typeof hyperframes.getStatus, 'function');
  assert.equal(typeof hyperframes.runAction, 'function');
});
test('Hyperframes requires an existing project folder with index.html', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-hf-'));
  try {
    await assert.rejects(() => hyperframes.validateProject(dir), /does not contain index.html/);
    await assert.rejects(() => hyperframes.runAction('arbitrary-command', dir), /Unsupported Hyperframes action/);
    await fs.writeFile(path.join(dir, 'index.html'), '<div id="root"></div>');
    assert.equal(await hyperframes.validateProject(dir), dir);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
