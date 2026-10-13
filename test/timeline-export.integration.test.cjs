'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const runFile = promisify(execFile);
const ffmpeg = require('ffmpeg-static');
const studio = require('../electron/studio.cjs');
const timeline = require('../electron/timeline.cjs');

test('generated sound effect can be inserted into a timeline and exported as a playable video with audio', async t => {
  if (!studio.getCapabilities().ffmpeg || !studio.getCapabilities().ffprobe) {
    t.skip('Bundled FFmpeg/FFprobe binaries are unavailable in this environment.');
    return;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-video-export-'));
  try {
    const sourceVideo = path.join(dir, 'source-video.mp4');
    await runFile(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=30:d=1.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', sourceVideo], { timeout: 120000 });
    const sound = await studio.generateSoundEffect({
      preset: 'beep',
      duration: 1.5,
      outputPath: path.join(dir, 'integration-beep.wav')
    });
    assert.equal(sound.ok, true);
    assert.ok((await fs.stat(sound.output)).size > 44);

    const result = await timeline.render({
      title: 'Playable export integration test',
      clips: [{
        id: 'source-video',
        type: 'video',
        file: sourceVideo,
        timelineStart: 0,
        sourceStart: 0,
        duration: 1.5,
        track: 'Video 1'
      }, {
        id: 'generated-sound',
        type: 'audio',
        file: sound.output,
        timelineStart: 0,
        sourceStart: 0,
        duration: 1.5,
        track: 'Audio 1'
      }]
    }, dir, 'verified-integration-export.mp4');

    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.equal(result.hasAudio, true);
    assert.ok(result.verifiedDuration > 0);
    assert.ok(result.fileSize > 256);
    const metadata = await studio.probe(result.output);
    assert.ok(metadata.streams.some(stream => stream.codec_type === 'video'));
    assert.ok(metadata.streams.some(stream => stream.codec_type === 'audio'));
    assert.ok(Math.abs(Number(metadata.format.duration) - 1.5) < 0.5, 'export duration should stay aligned with the source fixture');
    await runFile(ffmpeg, ['-v', 'error', '-i', result.output, '-f', 'null', '-'], { timeout: 120000 });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
