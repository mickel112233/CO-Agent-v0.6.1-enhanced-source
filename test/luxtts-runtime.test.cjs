'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const lux = require('../electron/luxtts.cjs');

test('LuxTTS validates text, reference audio, output, settings, and timeout', async () => {
  await assert.rejects(() => lux.generate({ text: ' ' }), /Enter text/);
  await assert.rejects(() => lux.generate({ text: 'x'.repeat(lux.MAX_TEXT_LENGTH + 1) }), /12,000 character limit/);
  await assert.rejects(() => lux.generate({ text: 'hello', referenceAudio: '', outputPath: 'out.wav' }), /reference audio/);
  await assert.rejects(() => lux.generate({ text: 'hello', referenceAudio: 'voice.wav', outputPath: '' }), /output WAV/);
  await assert.rejects(() => lux.generate({ text: 'hello', referenceAudio: 'voice.wav', outputPath: 'out.wav', numSteps: 0 }), /steps must be/);
  await assert.rejects(() => lux.generate({ text: 'hello', referenceAudio: 'voice.wav', outputPath: 'out.wav', speed: 4 }), /speed must be/);
  await assert.rejects(() => lux.generate({ text: 'hello', referenceAudio: 'voice.wav', outputPath: 'out.wav', timeoutMs: lux.MAX_TIMEOUT_MS + 1 }), /timeout must be/);
});

test('LuxTTS reports unprovisioned runtime without launching Python', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-'));
  try {
    const result = await lux.status({ appPath: dir, resourcesPath: path.join(dir, 'resources'), userDataPath: path.join(dir, 'data'), platform: process.platform });
    assert.equal(result.ok, true);
    assert.equal(result.installed, false);
    assert.match(result.message, /not provisioned yet/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('LuxTTS refuses nonexistent reference audio before launching worker', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-'));
  try {
    await assert.rejects(() => lux.generate({ text: 'hello', referenceAudio: path.join(dir, 'missing.wav'), outputPath: path.join(dir, 'out.wav') }, { appPath: dir, resourcesPath: path.join(dir, 'resources'), userDataPath: path.join(dir, 'data') }), /existing regular file/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
