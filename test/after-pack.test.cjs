'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const afterPack = require('../scripts/after-pack.cjs');

test('afterPack bundles a built pet executable into Electron resources on Windows', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-after-pack-'));
  try {
    const projectDir = path.join(root, 'project');
    const appOutDir = path.join(root, 'win-unpacked');
    const executable = path.join(projectDir, 'integrations', 'AI-Desktop-Pet', 'src-tauri', 'target', 'release', 'convai-desktop-pet.exe');
    await fs.mkdir(path.dirname(executable), { recursive: true });
    await fs.mkdir(appOutDir, { recursive: true });
    await fs.writeFile(executable, 'test-binary');
    await afterPack({ electronPlatformName: 'win32', packager: { projectDir }, appOutDir });
    assert.equal(await fs.readFile(path.join(appOutDir, 'resources', 'pet', 'convai-desktop-pet.exe'), 'utf8'), 'test-binary');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('afterPack tolerates a missing optional pet executable in local builds', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-after-pack-no-pet-'));
  try {
    const appOutDir = path.join(root, 'win-unpacked');
    await fs.mkdir(appOutDir, { recursive: true });
    await afterPack({ electronPlatformName: 'win32', packager: { projectDir: root }, appOutDir });
    await assert.rejects(fs.stat(path.join(appOutDir, 'resources', 'pet')), { code: 'ENOENT' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('afterPack does not bundle the Windows executable into non-Windows packages', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-after-pack-linux-'));
  try {
    const appOutDir = path.join(root, 'app');
    await fs.mkdir(appOutDir, { recursive: true });
    await afterPack({ electronPlatformName: 'linux', packager: { projectDir: root }, appOutDir });
    await assert.rejects(fs.stat(path.join(appOutDir, 'resources', 'pet')), { code: 'ENOENT' });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});


test('packaged smoke mode checks renderer, pet assets/licenses, and critical IPC handlers', async () => {
  const main = await fs.readFile(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  const workflow = await fs.readFile(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(main, /--co-agent-smoke-test/);
  assert.match(main, /renderer: 'mounted'/);
  assert.match(main, /document\.querySelector\('#root'\)/);
  assert.match(main, /Packaged renderer loaded a blank or unmounted UI/);
  assert.match(main, /createWindow\(\{ show: false \}\)/);
  assert.match(main, /pet-assets.*albedo.*id1_1\.png/);
  assert.match(main, /pet-assets.*licenses.*licence\.txt/);
  assert.match(main, /runtime:ollama-pull-cancel/);
  assert.match(main, /studio:render-timeline/);
  assert.match(workflow, /Smoke-test standalone ZIP package/);
  assert.match(main, /mainWindow\.on\('closed',[\s\S]*?\);\n  return load;/);
  assert.doesNotMatch(main, /return load;\n  mainWindow\.webContents\.on\('did-fail-load'/);
  assert.match(workflow, /Install and smoke-test NSIS installer/);
  const pkg = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const extra = pkg.build.extraResources;
  assert.ok(extra.some(item => item.from === 'integrations/AI-Desktop-Pet/LICENSE' && item.to === 'pet-assets/LICENSE'));
  assert.ok(extra.some(item => item.from === 'integrations/AI-Desktop-Pet/licenses' && item.to === 'pet-assets/licenses'));
  assert.ok(extra.some(item => item.from === 'THIRD-PARTY-NOTICES.md' && item.to === 'THIRD-PARTY-NOTICES.txt'));
});
