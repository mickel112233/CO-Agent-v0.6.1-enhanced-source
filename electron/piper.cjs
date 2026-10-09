'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

function locatePiper() {
  const candidates = [
    process.env.PIPER_PATH,
    path.join(process.resourcesPath || '', 'runtime', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper'),
    path.join(os.homedir(), '.co-agent', 'runtime', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper')
  ].filter(Boolean);
  return candidates[0] || null;
}
async function synthesize({ text, modelPath, outputPath, piperPath } = {}) {
  const input = String(text || '').trim();
  if (!input) throw new Error('Enter text to synthesize.');
  if (input.length > 20000) throw new Error('Text exceeds the 20,000 character limit.');
  const model = path.resolve(String(modelPath || ''));
  const output = path.resolve(String(outputPath || ''));
  if (!modelPath || !outputPath) throw new Error('A Piper voice model and output WAV path are required.');
  await fs.access(model);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const binary = piperPath || locatePiper();
  if (!binary) throw new Error('Piper was not found. Set PIPER_PATH or place it in the CO-Agent runtime folder.');
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['--model', model, '--output_file', output], { windowsHide: true, stdio: ['pipe','ignore','pipe'] });
    let stderr = '';
    child.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-5000); });
    child.on('error', reject);
    child.on('close', async code => {
      if (code !== 0) return reject(new Error('Piper failed (' + code + '): ' + stderr));
      try { await fs.access(output); resolve({ ok: true, output }); } catch { reject(new Error('Piper exited but output file was not created.')); }
    });
    child.stdin.end(input.replace(/[\r\n]+/g, ' ') + '\n');
  });
}
module.exports = { synthesize, locatePiper };
