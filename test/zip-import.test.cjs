'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zipImport = require('../electron/zip-import.cjs');

test('ZIP entry validation rejects traversal and absolute paths', () => {
  assert.equal(zipImport.normalizeEntryName('folder/file.txt'), 'folder/file.txt');
  assert.throws(() => zipImport.normalizeEntryName('../outside.txt'), /unsafe ZIP path|path-traversal/i);
  assert.throws(() => zipImport.normalizeEntryName('C:/Windows/system.ini'), /unsafe ZIP path|path-traversal/i);
  assert.throws(() => zipImport.normalizeEntryName('/rooted.txt'), /unsafe ZIP path|path-traversal/i);
});

test('ZIP scanner identifies manifests, lifecycle scripts, and risky files without executing them', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-zip-scan-'));
  try {
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'review-me', scripts: { postinstall: 'node setup.js', build: 'vite build' } }));
    await fs.writeFile(path.join(root, 'src', 'setup.js'), 'throw new Error("This file must never run");');
    await fs.writeFile(path.join(root, 'README.md'), '# safe review');
    const report = await zipImport.scanDirectory(root);
    assert.equal(report.fileCount, 3);
    assert.ok(report.manifests.includes('package.json'));
    assert.equal(report.installScripts[0].scripts.postinstall, 'node setup.js');
    assert.ok(report.riskyFiles.some(item => item.includes('setup.js')));
    assert.ok(report.files.includes('README.md'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('approved npm install rejects external folders, scripts-only projects, and URL dependencies', async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-install-'));
  const root = path.join(userData, 'import-review', 'sample');
  try {
    await fs.mkdir(root, { recursive: true });
    await assert.rejects(() => zipImport.installNodeDependencies(root, userData), /package\.json/i);
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'review-only', dependencies: { unsafe: 'git+https://example.com/unsafe.git' } }));
    await assert.rejects(() => zipImport.installNodeDependencies(root, userData), /plain registry version range/i);
    await fs.writeFile(path.join(root, '.npmrc'), 'registry=https://example.invalid/');
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'review-only', dependencies: { safe: '^1.2.3' } }));
    await assert.rejects(() => zipImport.installNodeDependencies(root, userData), /\.npmrc/i);
  } finally { await fs.rm(userData, { recursive: true, force: true }); }
});

test('ZIP scanner skips dependency/build trees and never follows symlinks', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-zip-link-'));
  const outside = path.join(root, 'outside.txt');
  try {
    await fs.writeFile(outside, 'private');
    await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(root, 'node_modules', 'ignored.js'), 'ignored');
    await fs.writeFile(path.join(root, 'README.md'), 'readme');
    try { await fs.symlink(outside, path.join(root, 'linked.txt'), 'file'); }
    catch (error) { if (['EPERM','EACCES','ENOTSUP'].includes(error.code)) { t.skip('Symlinks unavailable in this environment'); return; } throw error; }
    const report = await zipImport.scanDirectory(root);
    assert.ok(!report.files.some(file => file.startsWith('node_modules/')));
    assert.ok(report.riskyFiles.some(file => file.startsWith('Symlink:')));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
