'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const studio = require('../electron/studio.cjs');

test('all sound-effect presets produce readable stereo 48 kHz WAV files with expected duration', async t => {
  if (!studio.getCapabilities().ffmpeg || !studio.getCapabilities().ffprobe) {
    t.skip('Bundled FFmpeg/FFprobe binaries are unavailable in this environment.');
    return;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-sfx-fixture-'));
  try {
    for (const preset of ['impact', 'sweep', 'ambient', 'beep']) {
      const outputPath = path.join(dir, preset + '.wav');
      const result = await studio.generateSoundEffect({ preset, duration: 0.75, outputPath });
      assert.equal(result.ok, true);
      assert.ok((await fs.stat(result.output)).size > 44);
      const metadata = await studio.probe(result.output);
      const audio = metadata.streams.find(stream => stream.codec_type === 'audio');
      assert.ok(audio, preset + ' should contain an audio stream');
      assert.equal(audio.codec_name, 'pcm_s16le');
      assert.equal(Number(audio.sample_rate), 48000);
      assert.equal(Number(audio.channels), 2);
      assert.ok(Math.abs(Number(metadata.format.duration) - 0.75) < 0.08, preset + ' duration should match the requested duration');
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
