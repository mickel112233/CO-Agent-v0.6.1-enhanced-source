const test = require('node:test');
const assert = require('node:assert/strict');
const computer = require('../electron/computer.cjs');
const studio = require('../electron/studio.cjs');
const piper = require('../electron/piper.cjs');

test('computer automation exposes only an explicit allow-list', () => {
  assert.deepEqual(computer.allowedApps, ['notepad.exe','calc.exe','mspaint.exe','explorer.exe']);
  assert.equal(typeof computer.launchApp, 'function');
  assert.equal(typeof computer.openPath, 'function');
});

test('studio exposes media operations and capability diagnostics', () => {
  assert.equal(typeof studio.probe, 'function');
  assert.equal(typeof studio.extractAudio, 'function');
  assert.equal(typeof studio.concat, 'function');
  const caps = studio.getCapabilities();
  assert.equal(typeof caps.ffmpeg, 'boolean');
  assert.equal(typeof caps.ffprobe, 'boolean');
});

test('voice synthesis validates required inputs before spawning Piper', async () => {
  await assert.rejects(() => piper.synthesize({ text: '', modelPath: '', outputPath: '' }), /Enter text/);
});
