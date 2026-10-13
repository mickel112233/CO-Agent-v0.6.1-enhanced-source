'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');

async function collect(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (entry.isFile() && /\.(?:cjs|mjs|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

test('all main-process, integration, and script JavaScript files parse with Node', async () => {
  const files = [...await collect(path.join(root, 'electron')), ...await collect(path.join(root, 'scripts'))];
  for (const file of files) {
    try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); }
    catch (error) {
      const output = Buffer.concat([error.stdout || Buffer.alloc(0), error.stderr || Buffer.alloc(0)]).toString();
      assert.fail(path.relative(root, file) + ' failed Node syntax checking:\n' + output);
    }
  }
});
