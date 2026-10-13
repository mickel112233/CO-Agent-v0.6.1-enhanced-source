'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const { EventEmitter } = require('node:events');
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

test('LuxTTS accepts only RIFF/WAVE output headers', () => {
  assert.equal(lux.isWavHeader(Buffer.from('RIFF0000WAVE', 'ascii')), true);
  assert.equal(lux.isWavHeader(Buffer.from('NOTWAV000WAVE', 'ascii')), false);
  assert.equal(lux.isWavHeader(Buffer.from('RIFF0000NOPE', 'ascii')), false);
  assert.equal(lux.isWavHeader(Buffer.from('RIFF')), false);
});

test('LuxTTS cancellation removes partial output and never reports a cancelled job as success', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-cancel-'));
  const source = path.join(dir, 'third_party', 'LuxTTS');
  const worker = path.join(dir, 'scripts', 'luxtts-worker.py');
  const userDataPath = path.join(dir, 'user-data');
  const python = path.join(userDataPath, 'runtime', 'luxtts', 'venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
  const reference = path.join(dir, 'reference.wav');
  const output = path.join(dir, 'partial-output.wav');
  await fs.mkdir(source, { recursive: true });
  await fs.mkdir(path.dirname(worker), { recursive: true });
  await fs.mkdir(path.dirname(python), { recursive: true });
  await fs.writeFile(worker, '# test worker');
  await fs.writeFile(python, 'test python');
  await fs.writeFile(reference, Buffer.from('RIFF0000WAVE'));
  let spawnResolve;
  const spawnStarted = new Promise(resolve => { spawnResolve = resolve; });
  const child = new EventEmitter();
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { end(payload) { const request = JSON.parse(payload); fsSync.writeFileSync(request.outputPath, 'partial output'); } };
  child.kill = () => { child.exitCode = 1; queueMicrotask(() => child.emit('close', 1)); return true; };
  let pending;
  try {
    pending = lux.generate(
      { text: 'hello', referenceAudio: reference, outputPath: output, requestId: 'voice-cancel-test' },
      { appPath: dir, resourcesPath: path.join(dir, 'resources'), userDataPath, spawn: () => { spawnResolve(); return child; } }
    );
    await spawnStarted;
    assert.deepEqual(lux.cancel('voice-cancel-test'), { ok: true, cancelled: true });
    await assert.rejects(pending, /cancelled by user/i);
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
    assert.deepEqual(lux.cancel('voice-cancel-test'), { ok: true, cancelled: false });
  } finally {
    lux.cancel('voice-cancel-test');
    if (pending) await pending.catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('LuxTTS refuses to overwrite an existing output file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-existing-'));
  try {
    const reference = path.join(dir, 'reference.wav');
    const output = path.join(dir, 'existing.wav');
    await fs.writeFile(reference, Buffer.from('RIFF0000WAVE'));
    await fs.writeFile(output, 'keep this file');
    await assert.rejects(() => lux.generate({ text: 'hello', referenceAudio: reference, outputPath: output, requestId: 'existing-output' }), /already exists/i);
    assert.equal(await fs.readFile(output, 'utf8'), 'keep this file');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('LuxTTS rejects and removes malformed output even when the worker claims success', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-luxtts-invalid-output-'));
  const source = path.join(dir, 'third_party', 'LuxTTS');
  const worker = path.join(dir, 'scripts', 'luxtts-worker.py');
  const userDataPath = path.join(dir, 'user-data');
  const python = path.join(userDataPath, 'runtime', 'luxtts', 'venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
  const reference = path.join(dir, 'reference.wav');
  const output = path.join(dir, 'invalid-output.wav');
  await fs.mkdir(source, { recursive: true });
  await fs.mkdir(path.dirname(worker), { recursive: true });
  await fs.mkdir(path.dirname(python), { recursive: true });
  await fs.writeFile(worker, '# test worker');
  await fs.writeFile(python, 'test python');
  await fs.writeFile(reference, Buffer.from('RIFF0000WAVE'));
  let spawnResolve;
  const spawnStarted = new Promise(resolve => { spawnResolve = resolve; });
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { end(payload) {
    const request = JSON.parse(payload);
    fsSync.writeFileSync(request.outputPath, Buffer.alloc(64, 0x41));
    queueMicrotask(() => { child.stdout.emit('data', Buffer.from('{"ok":true}\n')); child.emit('close', 0); });
  } };
  child.kill = () => { queueMicrotask(() => child.emit('close', 1)); return true; };
  let pending;
  try {
    pending = lux.generate(
      { text: 'hello', referenceAudio: reference, outputPath: output, requestId: 'voice-invalid-test' },
      { appPath: dir, resourcesPath: path.join(dir, 'resources'), userDataPath, spawn: () => { spawnResolve(); return child; } }
    );
    await spawnStarted;
    await assert.rejects(pending, /valid RIFF\/WAVE/i);
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  } finally {
    lux.cancel('voice-invalid-test');
    if (pending) await pending.catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  }
});
