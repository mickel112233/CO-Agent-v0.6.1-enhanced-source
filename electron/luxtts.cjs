'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const MODEL_ID = 'YatharthS/LuxTTS';
const MAX_TEXT_LENGTH = 12000;
const MAX_TIMEOUT_MS = 15 * 60 * 1000;
function runtimePaths({ appPath = process.cwd(), userDataPath = path.join(os.homedir(), '.co-agent'), resourcesPath = process.resourcesPath, platform = process.platform } = {}) {
  const pythonName = platform === 'win32' ? 'python.exe' : 'python';
  const sourceCandidates = [
    resourcesPath && path.join(resourcesPath, 'luxtts', 'LuxTTS'),
    path.join(appPath, 'third_party', 'LuxTTS'),
    path.join(appPath, 'integrations', 'LuxTTS')
  ].filter(Boolean).map(value => path.resolve(value));
  const pythonCandidates = [
    path.join(userDataPath, 'runtime', 'luxtts', 'venv', platform === 'win32' ? 'Scripts' : 'bin', pythonName),
    process.env.CO_AGENT_LUXTTS_PYTHON
  ].filter(Boolean).map(value => path.resolve(value));
  return { sourceCandidates, pythonCandidates, workerCandidates: [resourcesPath && path.join(resourcesPath, 'scripts', 'luxtts-worker.py'), path.join(appPath, 'scripts', 'luxtts-worker.py')].filter(Boolean).map(value => path.resolve(value)) };
}
async function firstFile(paths) {
  for (const item of paths) {
    const stat = await fs.stat(item).catch(() => null);
    if (stat?.isFile()) return item;
  }
  return '';
}
async function firstDirectory(paths) {
  for (const item of paths) {
    const stat = await fs.stat(item).catch(() => null);
    if (stat?.isDirectory()) return item;
  }
  return '';
}
async function status(options = {}) {
  const paths = runtimePaths(options);
  const [python, source, worker] = await Promise.all([
    firstFile(paths.pythonCandidates), firstDirectory(paths.sourceCandidates), firstFile(paths.workerCandidates)
  ]);
  return {
    ok: true, installed: !!(python && source && worker), pythonAvailable: !!python,
    sourceAvailable: !!source, workerAvailable: !!worker, python: python || '', source: source || '', worker: (await firstFile(paths.workerCandidates)) || '',
    model: MODEL_ID, message: python && source && worker
      ? 'LuxTTS runtime files are ready; the model downloads on first generation if not cached.'
      : 'LuxTTS is not provisioned yet. CO-Agent needs its managed Python environment, pinned LuxTTS source, and worker script.'
  };
}
async function generate({ text, referenceAudio, outputPath, numSteps = 4, speed = 1, timeoutMs = MAX_TIMEOUT_MS } = {}, options = {}) {
  const input = String(text || '').trim();
  if (!input) throw new Error('Enter text to synthesize.');
  if (input.length > MAX_TEXT_LENGTH) throw new Error('LuxTTS text exceeds the 12,000 character limit.');
  if (typeof referenceAudio !== 'string' || !referenceAudio.trim()) throw new Error('Choose a reference audio file for voice cloning.');
  if (typeof outputPath !== 'string' || !outputPath.trim()) throw new Error('Choose an output WAV path.');
  if (!Number.isInteger(numSteps) || numSteps < 1 || numSteps > 12) throw new Error('LuxTTS steps must be between 1 and 12.');
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new Error('LuxTTS speed must be between 0.5 and 2.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > MAX_TIMEOUT_MS) throw new Error('LuxTTS timeout must be between 1 second and 15 minutes.');
  const reference = path.resolve(referenceAudio);
  const stat = await fs.stat(reference).catch(() => null);
  if (!stat?.isFile()) throw new Error('Reference audio must be an existing regular file.');
  const output = path.resolve(outputPath);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const runtime = await status(options);
  if (!runtime.installed) throw new Error(runtime.message);
  return new Promise((resolve, reject) => {
    const proc = spawn(runtime.python, ['-u', runtime.worker], { cwd: runtime.source, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false, timer;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    timer = setTimeout(() => { proc.kill(); finish(new Error('LuxTTS generation timed out after 15 minutes.')); }, timeoutMs);
    proc.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-100000); });
    proc.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8000); });
    proc.once('error', error => finish(new Error('Could not start LuxTTS Python worker: ' + error.message)));
    proc.once('close', async code => {
      if (settled) return;
      let result;
      try { result = JSON.parse(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) || '{}'); } catch {}
      if (code !== 0 || !result?.ok) { finish(new Error(String(result?.error || stderr || 'LuxTTS worker failed with exit code ' + code).slice(0, 1600))); return; }
      const outStat = await fs.stat(output).catch(() => null);
      if (!outStat?.isFile() || outStat.size < 44) { finish(new Error('LuxTTS reported success but no valid WAV output was created.')); return; }
      finish(null, { ok: true, output, sampleRate: 48000, bytes: outStat.size, model: MODEL_ID });
    });
    proc.stdin.end(JSON.stringify({ text: input, referenceAudio: reference, outputPath: output, numSteps, speed }));
  });
}
module.exports = { MODEL_ID, MAX_TEXT_LENGTH, MAX_TIMEOUT_MS, runtimePaths, status, generate };
