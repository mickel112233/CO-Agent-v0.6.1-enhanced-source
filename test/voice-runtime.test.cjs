'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { synthesize, MAX_TEXT_LENGTH, DEFAULT_TIMEOUT_MS } = require('../electron/piper.cjs');

test('TTS validates required text, model, output, and bounded timeout', async () => {
  await assert.rejects(() => synthesize({ text: '   ', modelPath: 'voice.onnx', outputPath: 'out.wav' }), /Enter text/);
  await assert.rejects(() => synthesize({ text: 'x'.repeat(MAX_TEXT_LENGTH + 1), modelPath: 'voice.onnx', outputPath: 'out.wav' }), /20,000 character limit/);
  await assert.rejects(() => synthesize({ text: 'hello', modelPath: '', outputPath: 'out.wav' }), /voice model and output WAV/);
  await assert.rejects(() => synthesize({ text: 'hello', modelPath: 'voice.onnx', outputPath: 'out.wav', timeoutMs: DEFAULT_TIMEOUT_MS + 1 }), /timeout must be between/);
});

test('TTS refuses a missing model and does not launch a process', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-tts-'));
  try {
    await assert.rejects(() => synthesize({
      text: 'hello',
      modelPath: path.join(dir, 'missing.onnx'),
      outputPath: path.join(dir, 'out.wav'),
      piperPath: path.join(dir, 'missing-piper')
    }), /regular file/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('TTS reports an unavailable executable with a useful error', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-tts-'));
  const model = path.join(dir, 'voice.onnx');
  try {
    await fs.writeFile(model, 'test model');
    await assert.rejects(() => synthesize({
      text: 'hello',
      modelPath: model,
      outputPath: path.join(dir, 'out.wav'),
      piperPath: path.join(dir, 'missing-piper')
    }), /Could not start Piper/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
