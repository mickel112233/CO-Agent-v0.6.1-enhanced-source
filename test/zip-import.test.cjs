'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zipImport = require('../electron/zip-import.cjs');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function makeZip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data || '', 'utf8');
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6); directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}


test('ZIP entry validation rejects traversal and absolute paths', () => {
  assert.equal(zipImport.normalizeEntryName('folder/file.txt'), 'folder/file.txt');
  assert.throws(() => zipImport.normalizeEntryName('../outside.txt'), /unsafe ZIP path|path-traversal/i);
  assert.throws(() => zipImport.normalizeEntryName('folder\\\\..\\\\outside.txt'), /unsafe ZIP path|path-traversal/i);
  assert.throws(() => zipImport.normalizeEntryName('C:/Windows/system.ini'), /unsafe ZIP path|path-traversal/i);
  assert.throws(() => zipImport.normalizeEntryName('/rooted.txt'), /unsafe ZIP path|path-traversal/i);
  assert.throws(() => zipImport.normalizeEntryName('folder/file.txt:stream'), /unsafe ZIP path/i);
  assert.throws(() => zipImport.normalizeEntryName('folder/CON.txt'), /unsafe ZIP path/i);
  assert.throws(() => zipImport.normalizeEntryName('folder/trailing. '), /unsafe ZIP path/i);
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


test('ZIP extraction accepts a normal archive and rejects traversal and duplicate names', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-zip-extract-'));
  try {
    const validZip = path.join(root, 'valid.zip');
    await fs.writeFile(validZip, makeZip([{ name: 'src/hello.txt', data: 'hello' }]));
    const validDestination = path.join(root, 'valid-out');
    const valid = await zipImport.extractArchive(validZip, validDestination);
    assert.equal(valid.ok, true);
    assert.equal(await fs.readFile(path.join(validDestination, 'src', 'hello.txt'), 'utf8'), 'hello');

    for (const [name, entries, pattern] of [
      ['traversal.zip', [{ name: '../outside.txt', data: 'nope' }], /unsafe|traversal/i],
      ['duplicate.zip', [{ name: 'same.txt', data: 'one' }, { name: 'same.txt', data: 'two' }], /duplicate|exists/i],
      ['windows-device.zip', [{ name: 'folder/CON.txt', data: 'nope' }], /unsafe|windows/i],
      ['ads.zip', [{ name: 'folder/file.txt:stream', data: 'nope' }], /unsafe|windows/i]
    ]) {
      const archive = path.join(root, name);
      await fs.writeFile(archive, makeZip(entries));
      const destination = path.join(root, name + '-out');
      await assert.rejects(() => zipImport.extractArchive(archive, destination), pattern);
      assert.equal(await fs.access(destination).then(() => true).catch(() => false), false);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
