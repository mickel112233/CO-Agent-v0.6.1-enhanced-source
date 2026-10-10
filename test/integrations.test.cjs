const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const integrations = require('../electron/integrations.cjs');

test('integration catalog keeps optional tools optional', () => {
  assert.equal(integrations.TOOLS.tesseract.required, false);
  assert.equal(integrations.TOOLS.hyperframes.required, false);
  assert.equal(integrations.TOOLS.piper.required, false);
  assert.equal(integrations.TOOLS.hyperframes.install, 'npm');
});

test('repository URLs are restricted to HTTPS GitHub owner/repo URLs', () => {
  assert.match('https://github.com/openclaw/openclaw', integrations.GITHUB_HTTPS);
  assert.match('https://github.com/openclaw/openclaw.git', integrations.GITHUB_HTTPS);
  assert.doesNotMatch('https://example.com/owner/repo', integrations.GITHUB_HTTPS);
  assert.doesNotMatch('file:///C:/private/repo', integrations.GITHUB_HTTPS);
  assert.doesNotMatch('https://github.com/owner/repo?cmd=bad', integrations.GITHUB_HTTPS);
});

test('branch and tag references reject option-like and path traversal values', () => {
  assert.match('main', integrations.REF_RE);
  assert.match('release/v1.2.0', integrations.REF_RE);
  assert.doesNotMatch('--upload-pack=malicious', integrations.REF_RE);
  assert.doesNotMatch('../secret', integrations.REF_RE);
});

test('repository import rejects invalid hosts before touching the filesystem', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-integrations-'));
  try {
    await assert.rejects(() => integrations.installRepo({ url: 'https://example.com/x/y' }, dir), /public GitHub repository URL/);
    await assert.rejects(() => integrations.installRepo({ url: 'https://github.com/x/y', ref: '--upload-pack=evil' }, dir), /unsupported characters/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('installed repository skill text is only returned from managed imported repos and is capped', async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-skill-'));
  const root = path.join(userData, 'extensions', 'sample-skill');
  await fs.mkdir(root, { recursive: true });
  try {
    await fs.writeFile(path.join(root, '.co-agent-source.json'), JSON.stringify({ url: 'https://github.com/example/skill' }));
    await fs.writeFile(path.join(root, 'SKILL.md'), '# Helpful skill\nUse clear steps.');
    const result = await integrations.getSkillContents(['sample-skill', '../outside', 'not-installed'], userData);
    assert.equal(result.length, 1);
    assert.match(result[0].content, /Helpful skill/);
    await fs.writeFile(path.join(root, 'SKILL.md'), 'x'.repeat(30001));
    const capped = await integrations.getSkillContents(['sample-skill'], userData);
    assert.equal(capped.length, 0);
  } finally { await fs.rm(userData, { recursive: true, force: true }); }
});
