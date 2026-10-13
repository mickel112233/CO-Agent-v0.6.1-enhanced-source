'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const MODEL_ID = 'YatharthS/LuxTTS';
const MAX_TEXT_LENGTH = 12000;
const MAX_TIMEOUT_MS = 15 * 60 * 1000;
const activeJobs = new Map();
const activeSetupJobs = new Map();
function isWavHeader(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE';
}
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
async function generate({ text, referenceAudio, outputPath, numSteps = 4, speed = 1, timeoutMs = MAX_TIMEOUT_MS, requestId = '' } = {}, options = {}, onProgress = () => {}) {
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
  if (await fs.stat(output).catch(() => null)) throw new Error('Output WAV already exists. Choose a new filename to avoid overwriting existing audio.');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const runtime = await status(options);
  if (!runtime.installed) throw new Error(runtime.message);
  const jobId = String(requestId || '');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)) throw new Error('LuxTTS request ID is missing or invalid.');
  if (activeJobs.has(jobId)) throw new Error('A LuxTTS request with this ID is already running.');
  return new Promise((resolve, reject) => {
    const spawnImpl = options.spawn || spawn;
    const proc = spawnImpl(runtime.python, ['-u', runtime.worker], { cwd: runtime.source, env: { ...process.env, PYTHONPATH: [runtime.source, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', lineBuffer = '', settled = false, timer;
    const finish = async (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) await fs.rm(output, { force: true }).catch(() => {});
      if (activeJobs.get(jobId) === proc) activeJobs.delete(jobId);
      error ? reject(error) : resolve(value);
    };
    activeJobs.set(jobId, proc);
    timer = setTimeout(() => { proc.kill(); finish(new Error('LuxTTS generation timed out after 15 minutes.')); }, timeoutMs);
    proc.stdout.on('data', chunk => {
      const value = chunk.toString(); stdout = (stdout + value).slice(-100000); lineBuffer += value;
      const lines = lineBuffer.split(/\r?\n/); lineBuffer = lines.pop() || '';
      for (const line of lines) { try { const event = JSON.parse(line); if (event?.stage) onProgress({ requestId: jobId, ...event }); } catch {} }
    });
    proc.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8000); });
    proc.once('error', error => finish(new Error('Could not start LuxTTS Python worker: ' + error.message)));
    proc.once('close', async code => {
      if (settled) return;
      if (proc.__coAgentCancelled) { await finish(new Error('LuxTTS generation cancelled by user.')); return; }
      let result;
      try { result = JSON.parse(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) || '{}'); } catch {}
      if (code !== 0 || !result?.ok) { await finish(new Error(String(result?.error || stderr || 'LuxTTS worker failed with exit code ' + code).slice(0, 1600))); return; }
      const outStat = await fs.stat(output).catch(() => null);
      let header = Buffer.alloc(12);
      if (outStat?.isFile() && outStat.size >= 44) {
        const handle = await fs.open(output, 'r').catch(() => null);
        if (handle) {
          try { const result = await handle.read(header, 0, 12, 0); header = header.subarray(0, result.bytesRead); }
          finally { await handle.close().catch(() => {}); }
        }
      }
      if (!outStat?.isFile() || outStat.size < 44 || !isWavHeader(header)) { await finish(new Error('LuxTTS reported success but did not create a valid RIFF/WAVE output.')); return; }
      await finish(null, { ok: true, output, sampleRate: 48000, bytes: outStat.size, model: MODEL_ID });
    });
    proc.stdin.end(JSON.stringify({ text: input, referenceAudio: reference, outputPath: output, numSteps, speed }));
  });
}

function cancelSetup(requestId) {
  const job = activeSetupJobs.get(String(requestId || ''));
  if (!job) return { ok: true, cancelled: false };
  job.cancelled = true;
  if (job.proc) { try { job.proc.kill(); } catch {} }
  return { ok: true, cancelled: true };
}

function cancel(requestId) {
  const id = String(requestId || '');
  const proc = activeJobs.get(id);
  if (!proc) return { ok: true, cancelled: false };
  try { proc.__coAgentCancelled = true; proc.kill(); return { ok: true, cancelled: true }; }
  catch (error) { return { ok: false, cancelled: false, error: String(error.message || error) }; }
}

function runSetupCommand(file, args, options, onProgress) {
  return new Promise((resolve, reject) => {
    const { jobId, activeSetupJobs: jobs, ...spawnOptions } = options;
    if (jobId && jobs?.get(jobId)?.cancelled) { reject(new Error('LuxTTS setup cancelled by user.')); return; }
    const proc = spawn(file, args, { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], ...spawnOptions });
    if (jobId && jobs?.has(jobId)) jobs.get(jobId).proc = proc;
    let stderr = '', stdout = '', settled = false;
    const timer = setTimeout(() => { proc.kill(); finish(new Error('LuxTTS setup command timed out.')); }, 30 * 60 * 1000);
    function finish(error, result) {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (jobId && jobs?.get(jobId)?.proc === proc) jobs.get(jobId).proc = null;
      error ? reject(error) : resolve(result);
    }
    proc.stdout.on('data', data => { const value = data.toString(); stdout = (stdout + value).slice(-12000); if (onProgress) onProgress(value.slice(-2000)); });
    proc.stderr.on('data', data => { const value = data.toString(); stderr = (stderr + value).slice(-12000); if (onProgress) onProgress(value.slice(-2000)); });
    proc.once('error', error => finish(error));
    proc.once('close', code => {
      if (jobId && jobs?.get(jobId)?.cancelled) finish(new Error('LuxTTS setup cancelled by user.'));
      else if (code === 0) finish(null, { stdout, stderr });
      else finish(new Error((stderr || stdout || 'Setup command failed with exit code ' + code).slice(-2000)));
    });
  });
}
async function setup({ pythonPath = '', requestId = '' } = {}, options = {}, onProgress = () => {}) {
  const jobId = String(requestId || '');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)) throw new Error('LuxTTS setup request ID is missing or invalid.');
  if (activeSetupJobs.has(jobId)) throw new Error('A LuxTTS setup with this ID is already running.');
  activeSetupJobs.set(jobId, { cancelled: false, proc: null });
  try {
  const paths = runtimePaths(options);
  const source = await firstDirectory(paths.sourceCandidates);
  if (!source) throw new Error('Pinned LuxTTS source was not found. Reinstall CO-Agent with submodules, or restore third_party/LuxTTS.');
  const requirements = path.join(source, 'requirements.txt');
  if (!(await fs.stat(requirements).catch(() => null))?.isFile()) throw new Error('LuxTTS requirements.txt is missing from the source checkout.');
  const userDataPath = options.userDataPath || path.join(os.homedir(), '.co-agent');
  const venv = path.join(userDataPath, 'runtime', 'luxtts', 'venv');
  const venvPython = path.join(venv, process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
  const bootstrap = String(pythonPath || (process.platform === 'win32' ? 'py' : 'python3'));
  const bootstrapArgs = !pythonPath && process.platform === 'win32' ? ['-3.11'] : [];
  const probe = await runSetupCommand(bootstrap, [...bootstrapArgs, '--version'], { jobId, activeSetupJobs }, chunk => onProgress({ requestId: jobId, stage: 'python-check', message: chunk }));
  const versionText = (probe.stdout + ' ' + probe.stderr).trim();
  const version = versionText.match(/Python\s+(\d+)\.(\d+)/i);
  if (!version || Number(version[1]) !== 3 || Number(version[2]) < 10 || Number(version[2]) > 11) throw new Error('LuxTTS requires Python 3.10 or 3.11. Detected: ' + (versionText || 'unknown version') + '. Install Python 3.11 and retry.');
  await fs.mkdir(path.dirname(venv), { recursive: true });
  onProgress({ requestId: jobId, stage: 'venv', message: 'Creating managed Python environment…' });
  await runSetupCommand(bootstrap, [...bootstrapArgs, '-m', 'venv', venv], { jobId, activeSetupJobs }, chunk => onProgress({ requestId: jobId, stage: 'venv', message: chunk }));
  onProgress({ requestId: jobId, stage: 'dependencies', message: 'Installing LuxTTS dependencies. This can take a while and may download several gigabytes…' });
  await runSetupCommand(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], { jobId, activeSetupJobs }, chunk => onProgress({ requestId: jobId, stage: 'dependencies', message: chunk }));
  await runSetupCommand(venvPython, ['-m', 'pip', 'install', '-r', requirements], { cwd: source, jobId, activeSetupJobs }, chunk => onProgress({ requestId: jobId, stage: 'dependencies', message: chunk }));
  // The upstream requirements do not declare soundfile directly, but the
  // isolated worker imports it to write a standards-compliant WAV file.
  await runSetupCommand(venvPython, ['-m', 'pip', 'install', 'soundfile'], { cwd: source, jobId, activeSetupJobs }, chunk => onProgress({ requestId: jobId, stage: 'dependencies', message: chunk }));
  const result = await status({ ...options, userDataPath });
  if (!result.installed) throw new Error('LuxTTS setup finished but runtime verification failed: ' + result.message);
  const verification = await runSetupCommand(result.python, ['-c', 'import sys, soundfile; print(sys.version); print(soundfile.__version__)'], { jobId, activeSetupJobs }, chunk => onProgress({ requestId: jobId, stage: 'verify', message: chunk }));
  return { ok: true, python: result.python, source: result.source, message: 'LuxTTS Python environment installed and verified (' + verification.stdout.trim().split(/\r?\n/)[0] + '). Model weights are downloaded on first generation.' };
  } finally { activeSetupJobs.delete(jobId); }
}

module.exports = { MODEL_ID, MAX_TEXT_LENGTH, MAX_TIMEOUT_MS, runtimePaths, status, generate, setup, cancel, cancelSetup, isWavHeader };
