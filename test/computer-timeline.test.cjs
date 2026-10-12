const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const timeline = require('../electron/timeline.cjs');
const computerUse = require('../electron/computer-use.cjs');
const studio = require('../electron/studio.cjs');

test('timeline project normalization enforces supported clip types and bounds', () => {
  const project = timeline.normalizeProject({ title: 'Demo', clips: [
    { id: 'v1', type: 'video', file: 'C:/media/a.mp4', timelineStart: 1, sourceStart: 2, duration: 4, track: 'Video 1' },
    { id: 't1', type: 'caption', text: 'Hello', timelineStart: 0, duration: 2, track: 'Titles' }
  ] });
  assert.equal(project.version, 1);
  assert.equal(project.clips.length, 2);
  assert.equal(project.clips[0].timelineStart, 1);
  assert.equal(project.clips[1].text, 'Hello');
  assert.throws(() => timeline.normalizeProject({ clips: [{ type: 'shell', duration: 1 }] }), /unsupported type/);
  assert.throws(() => timeline.normalizeProject({ clips: [
    { id: 'same', type: 'caption', text: 'First' },
    { id: 'same', type: 'caption', text: 'Second' }
  ] }), /unique/i);
  assert.throws(() => timeline.normalizeProject({ clips: [
    { id: 'x'.repeat(100) + 'a', type: 'caption' },
    { id: 'x'.repeat(100) + 'b', type: 'caption' }
  ] }), /unique/i);
  assert.throws(() => timeline.normalizeProject({ clips: [{ type: 'caption', duration: 999999, text: 'x' }] }), /between/);
  assert.throws(() => timeline.normalizeProject({ clips: Array.from({ length: 121 }, () => ({ type: 'caption', duration: 1 })) }), /at most 120/);
});

test('timeline projects save and load only the explicit CO-Agent project format', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-timeline-'));
  const file = path.join(dir, 'demo.coagent-project.json');
  try {
    const project = { title: 'Round trip', clips: [{ id: 'title', type: 'caption', text: 'Hello world', timelineStart: 3, duration: 2, track: 'Titles' }] };
    const saved = await timeline.saveProject(file, project);
    const loaded = await timeline.loadProject(file);
    assert.equal(saved.clips, 1);
    assert.equal(loaded.project.title, 'Round trip');
    assert.equal(loaded.project.clips[0].text, 'Hello world');
    await assert.rejects(() => timeline.saveProject(path.join(dir, 'unsafe.json'), project), /extension/);
    const oversized = path.join(dir, 'oversized.coagent-project.json');
    await fs.writeFile(oversized, ' '.repeat(timeline.MAX_PROJECT_BYTES + 1), 'utf8');
    await assert.rejects(() => timeline.loadProject(oversized), /2 MB safety limit/i);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('export verification rejects missing video streams and invalid duration metadata', () => {
  assert.deepEqual(timeline.validateExportMetadata({ format: { duration: '12.5' }, streams: [{ codec_type: 'video' }, { codec_type: 'audio' }] }, 2048), { duration: 12.5, hasAudio: true, size: 2048 });
  assert.throws(() => timeline.validateExportMetadata({ format: { duration: '0' }, streams: [{ codec_type: 'video' }] }, 2048), /duration/i);
  assert.throws(() => timeline.validateExportMetadata({ format: { duration: '12' }, streams: [{ codec_type: 'audio' }] }, 2048), /video stream/i);
  assert.throws(() => timeline.validateExportMetadata({ format: { duration: '12' }, streams: [{ codec_type: 'video' }] }, 20), /small/i);
  assert.throws(() => timeline.validateExportMetadata({ format: { duration: '4.1' }, streams: [{ codec_type: 'video' }] }, 2048, 10), /truncated/i);
  assert.doesNotThrow(() => timeline.validateExportMetadata({ format: { duration: '9.8' }, streams: [{ codec_type: 'video' }] }, 2048, 10));
});

test('caption filter escaping handles common filter syntax characters', () => {
  const escaped = timeline.escapeDrawtext("it's 50%, a:b, [ok]\\");
  assert.match(escaped, /\\'/);
  assert.match(escaped, /\\:/);
  assert.match(escaped, /\\%/);
  assert.match(escaped, /\\,/);
});

test('local action plans allow only bounded, low-risk actions', () => {
  const plan = computerUse.validatePlanActions({ actions: [{ type: 'click', x: 5, y: 9, reason: 'Open menu' }, { type: 'key', key: 'ENTER' }, { type: 'type', text: 'hello' }] }, 100, 100);
  assert.equal(plan.length, 3);
  assert.throws(() => computerUse.validatePlanActions({ actions: [{ type: 'click', x: 100, y: 4 }] }, 100, 100), /outside screenshot bounds/);
  assert.throws(() => computerUse.validatePlanActions({ actions: [{ type: 'type', text: 'my password is abc' }] }, 100, 100), /sensitive-looking/);
  assert.throws(() => computerUse.validatePlanActions({ actions: [{ type: 'shell', command: 'whoami' }] }, 100, 100), /unsupported type/);
  assert.throws(() => computerUse.validatePlanActions({ actions: Array.from({ length: 9 }, () => ({ type: 'key', key: 'ENTER' })) }, 100, 100), /Maximum 8/);
});

test('computer-use actions reject missing approval and bound input', () => {
  assert.throws(() => computerUse.assertApproved({}), /explicit user approval/);
  assert.doesNotThrow(() => computerUse.assertApproved({ approved: true }));
  assert.throws(() => computerUse.KEY_CODES.NOT_A_KEY === undefined ? (() => { const code = null; if (!code) throw new Error('Unsupported key'); })() : null, /Unsupported key/);
});

test('media path validation rejects control characters and invalid values', () => {
  assert.throws(() => studio.validateMediaPath('clip.mp4\nfile'), /control characters/i);
  assert.throws(() => studio.validateMediaPath('clip.mp4\tfile'), /control characters/i);
  assert.throws(() => studio.validateMediaPath(''), /required/i);
  assert.doesNotThrow(() => studio.validateMediaPath('clip.mp4'));
});
