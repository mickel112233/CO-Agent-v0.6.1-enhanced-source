'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const hyperframes = require('../electron/hyperframes.cjs');

test('Hyperframes composition generator creates escaped self-contained motion graphics', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-hyperframes-'));
  try {
    const result = await hyperframes.createComposition({ title: '<script>alert(1)</script>', description: 'A & B', outputDir: path.join(root, 'project') });
    const html = await fs.readFile(result.entry, 'utf8');
    assert.equal(result.ok, true);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /A &amp; B/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    await assert.rejects(() => hyperframes.createComposition({ title: 'No overwrite', outputDir: result.projectDir }), /already contains index\.html/i);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('Hyperframes composition generator requires a title and output folder', async () => {
  await assert.rejects(() => hyperframes.createComposition({ title: 'x' }), /output folder/i);
  await assert.rejects(() => hyperframes.createComposition({ title: '  ', outputDir: os.tmpdir() }), /title/i);
});
