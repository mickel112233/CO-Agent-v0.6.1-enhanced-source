'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const MAX_TEXT_LENGTH = 20000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function locatePiper() {
  const candidates = [
    process.env.PIPER_PATH,
    path.join(process.resourcesPath || '', 'runtime', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper'),
    path.join(os.homedir(), '.co-agent', 'runtime', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper')
  ].filter(Boolean);
  return candidates[0] || null;
}

async function synthesize({ text, modelPath, outputPath, piperPath, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const input = String(text || '').trim();
  if (!input) throw new Error('Enter text to synthesize.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('Text exceeds the 20,000 character limit.');
  if (typeof modelPath !== 'string' || !modelPath.trim() || typeof outputPath !== 'string' || !outputPath.trim()) {
    throw new Error('A Piper voice model and output WAV path are required.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > DEFAULT_TIMEOUT_MS) {
    throw new Error('TTS timeout must be between 100 ms and 5 minutes.');
  }

  const model = path.resolve(modelPath);
  const output = path.resolve(outputPath);
  const modelStat = await fs.stat(model).catch(() => null);
  if (!modelStat?.isFile()) throw new Error('The Piper voice model must be an existing regular file.');
  await fs.mkdir(path.dirname(output), { recursive: true });

  const binary = piperPath || locatePiper();
  if (!binary) throw new Error('Piper was not found. Set PIPER_PATH or place it in the CO-Agent runtime folder.');

  return new Promise((resolve, reject) => {
    let stderr = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };
    let child;
    try {
      child = spawn(binary, ['--model', model, '--output_file', output], {
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'pipe']
      });
    } catch (error) {
      finish(error);
      return;
    }

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Piper text-to-speech timed out after 5 minutes.'));
    }, timeoutMs);
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-5000); });
    child.on('error', error => finish(new Error('Could not start Piper: ' + String(error.message || error).slice(0, 1000))));
    child.on('close', async code => {
      if (settled) return;
      if (code !== 0) return finish(new Error('Piper failed (' + code + '): ' + stderr));
      try {
        const stat = await fs.stat(output);
        if (!stat.isFile() || stat.size < 44) throw new Error('Piper exited but did not create a valid, non-empty WAV output file.');
        finish(null, { ok: true, output, size: stat.size });
      } catch (error) {
        finish(error?.message?.startsWith('Piper exited') ? error : new Error('Piper exited but output file was not created.'));
      }
    });
    child.stdin.on('error', () => { /* Piper may close stdin after reporting an error; close handler reports its exit status. */ });
    child.stdin.end(input.replace(/[\r\n]+/g, ' ') + '\n');
  });
}

module.exports = { synthesize, locatePiper, MAX_TEXT_LENGTH, DEFAULT_TIMEOUT_MS };
