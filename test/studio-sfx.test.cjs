'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const studio = require('../electron/studio.cjs');

test('sound-effect generator builds local FFmpeg WAV commands for supported presets', () => {
  for (const preset of ['impact', 'sweep', 'ambient', 'beep']) {
    const plan = studio.buildSoundEffectArgs(preset, 2.5, 'C:/temp/generated.wav');
    assert.equal(plan.output, require('node:path').resolve('C:/temp/generated.wav'));
    assert.ok(plan.args.includes('-f'));
    assert.ok(plan.args.includes('lavfi'));
    assert.ok(plan.args.includes('-c:a'));
    assert.ok(plan.args.some(value => String(value).includes('duration=2.5') || String(value).includes(':d=2.5')));
    assert.ok(plan.args.at(-1).endsWith('generated.wav'));
  }
});

test('sound-effect generator rejects unsupported presets, unsafe durations, and missing output', () => {
  assert.throws(() => studio.buildSoundEffectArgs('shell-command', 2, '/tmp/out.wav'), /supported sound-effect preset/i);
  assert.throws(() => studio.buildSoundEffectArgs('beep', 0.1, '/tmp/out.wav'), /between 0.25 and 12/i);
  assert.throws(() => studio.buildSoundEffectArgs('beep', 13, '/tmp/out.wav'), /between 0.25 and 12/i);
  assert.throws(() => studio.buildSoundEffectArgs('beep', 2, ''), /output path/i);
});
