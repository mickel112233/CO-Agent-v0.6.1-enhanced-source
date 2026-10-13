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

test('LuxTTS setup cancellation is safe for unknown jobs', () => {
  assert.deepEqual(lux.cancelSetup('missing-setup'), { ok: true, cancelled: false });
});

test('LuxTTS cancellation is safe for unknown or already-finished jobs', () => {
  assert.deepEqual(lux.cancel('missing-job'), { ok: true, cancelled: false });
  assert.deepEqual(lux.cancel(''), { ok: true, cancelled: false });
});


test('LuxTTS worker rejects malformed reference-audio requests without loading model weights', async t => {
  const { spawn } = require('node:child_process');
  const python = process.env.CO_AGENT_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const { promisify } = require('node:util');
  const { execFile } = require('node:child_process');
  const run = promisify(execFile);
  try {
    await run(python, ['--version'], { timeout: 5000 });
  } catch {
    t.skip('Python is not installed in this runner; worker input validation remains covered by the Windows packaging job.');
    return;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-worker-'));
  try {
    const worker = path.join(__dirname, '..', 'scripts', 'luxtts-worker.py');
    const output = path.join(dir, 'out.wav');
    const request = { text: 'hello', referenceAudio: path.join(dir, 'missing.wav'), outputPath: output };
    const response = await new Promise((resolve, reject) => {
      const child = spawn(python, [worker], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let stdout = '', stderr = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', code => {
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        try {
          assert.ok(lines.length > 0, 'worker should emit a structured JSON error');
          const value = JSON.parse(lines.at(-1));
          assert.equal(code, 1, stderr);
          resolve(value);
        } catch (error) { reject(error); }
      });
      child.stdin.end(JSON.stringify(request));
    });
    assert.equal(response.ok, false);
    assert.match(response.error, /Reference audio file does not exist/);
    await assert.rejects(() => fs.stat(output), { code: 'ENOENT' });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('LuxTTS can generate and validate a real WAV from a deterministic reference fixture when runtime is provisioned', async t => {
  const python = process.env.CO_AGENT_LUXTTS_PYTHON;
  if (!python) {
    t.skip('Set CO_AGENT_LUXTTS_PYTHON to a provisioned LuxTTS Python interpreter to run model-backed reference-audio synthesis.');
    return;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-real-'));
  try {
    const reference = path.join(dir, 'reference.wav');
    const output = path.join(dir, 'generated.wav');
    const sampleRate = 24000;
    const seconds = 5;
    const dataBytes = sampleRate * seconds * 2;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + dataBytes, 4); header.write('WAVE', 8);
    header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(dataBytes, 40);
    const pcm = Buffer.alloc(dataBytes);
    for (let i = 0; i < sampleRate * seconds; i++) pcm.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 180 * i / sampleRate) * 3500), i * 2);
    await fs.writeFile(reference, Buffer.concat([header, pcm]));
    const result = await lux.generate({ text: 'This is a short CO-Agent voice generation verification.', referenceAudio: reference, outputPath: output, requestId: 'fixture-voice-test', timeoutMs: lux.MAX_TIMEOUT_MS });
    assert.equal(result.ok, true);
    const wav = await fs.readFile(output);
    assert.ok(wav.length > 44, 'generated WAV must contain audio samples');
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(result.sampleRate, 48000);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('LuxTTS rejects invalid worker output and only returns verified WAV metadata', async t => {
  const studio = require('../electron/studio.cjs');
  const { EventEmitter } = require('node:events');
  const { PassThrough } = require('node:stream');
  if (!studio.getCapabilities().ffprobe) { t.skip('FFprobe is unavailable in this runner.'); return; }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-verified-'));
  try {
    const appPath = dir, userDataPath = path.join(dir, 'data'), resourcesPath = path.join(dir, 'resources');
    const python = path.join(userDataPath, 'runtime', 'luxtts', 'venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
    await fs.mkdir(path.dirname(python), { recursive: true });
    await fs.writeFile(python, 'fixture');
    await fs.mkdir(path.join(appPath, 'third_party', 'LuxTTS'), { recursive: true });
    await fs.mkdir(path.join(appPath, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(appPath, 'scripts', 'luxtts-worker.py'), '# fixture worker');
    const validWav = Buffer.alloc(44 + 48000);
    validWav.write('RIFF', 0); validWav.writeUInt32LE(validWav.length - 8, 4); validWav.write('WAVE', 8);
    validWav.write('fmt ', 12); validWav.writeUInt32LE(16, 16); validWav.writeUInt16LE(1, 20);
    validWav.writeUInt16LE(1, 22); validWav.writeUInt32LE(48000, 24); validWav.writeUInt32LE(96000, 28);
    validWav.writeUInt16LE(2, 32); validWav.writeUInt16LE(16, 34); validWav.write('data', 36); validWav.writeUInt32LE(validWav.length - 44, 40);
    const reference = path.join(dir, 'reference.wav');
    await fs.writeFile(reference, validWav);
    const fakeSpawn = (_file, _args, _spawnOptions) => {
      const child = new EventEmitter();
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.stdin = { end: requestText => {
        setImmediate(async () => {
          const request = JSON.parse(requestText);
          const outputBytes = request.text === 'invalid' ? Buffer.alloc(64) : validWav;
          await fs.writeFile(request.outputPath, outputBytes);
          child.stdout.write(JSON.stringify({ ok: true, output: request.outputPath, sampleRate: 48000, bytes: outputBytes.length }) + '\n');
          child.stdout.end(); child.stderr.end(); child.emit('close', 0);
        });
      } };
      child.kill = () => { child.__coAgentCancelled = true; setImmediate(() => child.emit('close', 1)); };
      return child;
    };
    const existingPath = path.join(dir, 'existing.wav');
    await fs.writeFile(existingPath, 'preserve me');
    await assert.rejects(() => lux.generate({ text: 'verified', referenceAudio: reference, outputPath: existingPath, requestId: 'existing-output' }, { appPath, userDataPath, resourcesPath, spawn: fakeSpawn }), /will not overwrite/i);
    assert.equal(await fs.readFile(existingPath, 'utf8'), 'preserve me');
    await assert.rejects(() => lux.generate({ text: 'verified', referenceAudio: reference, outputPath: path.join(dir, 'bad.mp3'), requestId: 'bad-extension' }, { appPath, userDataPath, resourcesPath, spawn: fakeSpawn }), /must end in \.wav/i);
    const goodPath = path.join(dir, 'good.wav');
    const result = await lux.generate({ text: 'verified', referenceAudio: reference, outputPath: goodPath, requestId: 'verified-wav' }, { appPath, userDataPath, resourcesPath, spawn: fakeSpawn });
    assert.equal(result.verified, true);
    assert.equal(result.codec, 'pcm_s16le');
    assert.equal(result.sampleRate, 48000);
    assert.ok(result.duration > 0);
    const badPath = path.join(dir, 'bad.wav');
    await assert.rejects(() => lux.generate({ text: 'invalid', referenceAudio: reference, outputPath: badPath, requestId: 'invalid-wav' }, { appPath, userDataPath, resourcesPath, spawn: fakeSpawn }), /FFprobe validation/i);
    await assert.rejects(() => fs.stat(badPath), { code: 'ENOENT' });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
