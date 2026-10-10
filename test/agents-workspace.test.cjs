const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const workspace = require('../electron/workspace.cjs');
const agents = require('../electron/agent-orchestrator.cjs');

test('workspace only resolves relative paths within selected root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-workspace-'));
  try {
    await workspace.setRoot(root);
    assert.equal(workspace.safeRelativePath('src/App.jsx'), path.join('src', 'App.jsx'));
    assert.throws(() => workspace.safeRelativePath('../outside.txt'), /relative path|traversal/i);
    assert.throws(() => workspace.safeRelativePath('C:\\outside.txt'), /relative path/i);
    assert.throws(() => workspace.safeRelativePath('.env'), /blocked/i);
    assert.throws(() => workspace.safeRelativePath('.env.development'), /blocked/i);
    assert.throws(() => workspace.safeRelativePath('private.pem'), /blocked/i);
    assert.throws(() => workspace.safeRelativePath('node_modules/pkg/index.js'), /blocked/i);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('workspace lists, reads, applies approved file proposals and backs up originals', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-workspace-'));
  try {
    await workspace.setRoot(root);
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src', 'app.js'), 'old content', 'utf8');
    await fs.writeFile(path.join(root, '.env'), 'DO_NOT_READ=1', 'utf8');
    const listing = await workspace.listFiles({ maxFiles: 50 });
    assert.ok(listing.files.some(file => file.path === 'src/app.js'));
    assert.ok(!listing.files.some(file => file.path === '.env'));
    assert.equal((await workspace.readFile('src/app.js')).content, 'old content');
    await assert.rejects(workspace.readFile('.env'), /blocked/i);
    await assert.rejects(workspace.applyChanges({ files: [{ path: 'src/app.js', content: 'new' }] }), /approval/i);
    const result = await workspace.applyChanges({ approved: true, files: [{ path: 'src/app.js', content: 'new content' }, { path: 'src/new.js', content: 'created' }] });
    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(root, 'src', 'app.js'), 'utf8'), 'new content');
    assert.equal(await fs.readFile(path.join(root, 'src', 'new.js'), 'utf8'), 'created');
    assert.equal(await fs.readFile(path.join(result.backupDirectory, 'src', 'app.js'), 'utf8'), 'old content');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('workspace rejects symlink traversal and oversized file proposals', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-workspace-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-outside-'));
  try {
    await workspace.setRoot(root);
    await fs.writeFile(path.join(outside, 'outside.txt'), 'secret', 'utf8');
    await fs.symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(workspace.readFile('linked/outside.txt'), /symbolic links/i);
    await assert.rejects(workspace.applyChanges({ approved: true, files: [{ path: 'large.txt', content: 'x'.repeat(workspace.MAX_FILE_BYTES + 1) }] }), /120 KB/i);
    await assert.rejects(workspace.applyChanges({ approved: true, files: [{ path: '.github/workflows/ci.yml', content: 'unsafe: true' }] }), /workflow files are blocked/i);
    await assert.rejects(workspace.applyChanges({ approved: true, files: Array.from({ length: 13 }, (_, i) => ({ path: 'f' + i + '.txt', content: 'x' })) }), /1 and 12/i);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('terminal only exposes fixed, reviewable command presets', () => {
  const commands = workspace.commandList();
  assert.deepEqual(commands.map(command => command.id), ['npm-test', 'npm-build', 'git-status', 'git-diff-check', 'npm-audit']);
  assert.ok(commands.every(command => !command.command.includes(';') && !command.command.includes('&&')));
  assert.throws(() => workspace.runCommand('rm-everything'), /approved terminal command/i);
});

test('workflow pipeline normalization maps dependencies and rejects unsafe planner output', () => {
  const pipeline = agents.normalizePipeline([
    { id: 'discover', title: 'Inspect', role: 'researcher', skill: 'reviewer', dependsOn: [] },
    { id: 'implement', title: 'Implement', role: 'implementer', skill: 'implementer', dependsOn: ['discover'] },
    { id: 'verify', title: 'Verify', role: 'tester', skill: 'test-engineer', dependsOn: ['implement', 'missing'] }
  ]);
  assert.deepEqual(pipeline[0].dependsOn, []);
  assert.deepEqual(pipeline[1].dependsOn, ['step-1']);
  assert.deepEqual(pipeline[2].dependsOn, ['step-2']);
  assert.throws(() => agents.normalizePipeline([{ role: 'shell', skill: 'planner' }, { role: 'tester', skill: 'test-engineer' }]), /unsupported role/i);
  assert.throws(() => agents.normalizePipeline([{ role: 'planner', skill: 'planner' }]), /2–7 step workflow/i);
});

test('built-in agent harness provides multiple specialist roles and skills', () => {
  const agentsList = agents.getAgents();
  const skills = agents.getSkills();
  for (const role of ['planner', 'implementer', 'reviewer', 'tester', 'security', 'designer', 'architect', 'performance', 'api-integrator', 'accessibility', 'release-engineer', 'computer-operator', 'game-developer', 'app-artist']) assert.ok(agentsList.some(agent => agent.id === role));
  for (const skill of ['planner', 'implementer', 'reviewer', 'test-engineer', 'security', 'electron', 'frontend', 'docs', 'media', 'architecture', 'performance', 'api-integration', 'accessibility', 'devops', 'dependency-audit', 'database', 'prompt-engineering', 'browser-testing', 'performance-testing', 'computer-use', 'mcp-tools', 'godot', 'blender', 'game-development', 'workflow-orchestration']) assert.ok(skills.some(item => item.id === skill));
  assert.equal(skills.length, 26);
  assert.equal(agentsList.length, 16);
  const extended = agents.normalizePipeline([{ id: 'design', role: 'architect', skill: 'architecture' }, { id: 'operate', role: 'computer-operator', skill: 'computer-use', dependsOn: ['design'] }]);
  assert.deepEqual(extended[1].dependsOn, ['step-1']);
  assert.deepEqual(agents.parseJson('{"ok":true}'), { ok: true });
});
