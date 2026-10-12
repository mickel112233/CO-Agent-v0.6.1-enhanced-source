'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const EXE_NAME = 'convai-desktop-pet.exe';
let child = null;
let runningPath = '';

function candidates({ resourcesPath = process.resourcesPath, appPath = process.cwd(), userDataPath = '', platform = process.platform } = {}) {
  if (platform !== 'win32') return [];
  const result = [];
  if (resourcesPath) result.push(path.join(resourcesPath, 'pet', EXE_NAME));
  if (userDataPath) result.push(path.join(userDataPath, 'runtime', 'pet', EXE_NAME));
  result.push(path.join(appPath, 'integrations', 'AI-Desktop-Pet', 'src-tauri', 'target', 'release', EXE_NAME));
  result.push(path.join(appPath, 'runtime', 'pet', EXE_NAME));
  return [...new Set(result.map(value => path.resolve(value)))];
}
async function locatePetExecutable(options = {}) {
  for (const candidate of candidates(options)) {
    const stat = await fs.stat(candidate).catch(() => null);
    if (stat?.isFile()) return candidate;
  }
  return null;
}
async function status(options = {}) {
  const executable = await locatePetExecutable(options);
  return { ok: true, supported: (options.platform || process.platform) === 'win32', installed: !!executable, running: !!(child && child.exitCode === null), executable: executable || '', message: executable ? 'Desktop pet runtime is ready.' : 'Desktop pet source is included, but its Windows executable has not been built or packaged yet.' };
}
async function launch(options = {}) {
  if (child && child.exitCode === null) return { ok: true, alreadyRunning: true, executable: runningPath };
  const executable = await locatePetExecutable(options);
  if (!executable) throw new Error('Desktop pet is not built yet. Build integrations/AI-Desktop-Pet with its documented Tauri 2 Windows toolchain, then place convai-desktop-pet.exe into resources/pet/ or the CO-Agent user-data runtime/pet folder.');
  const spawnProcess = options.spawn || spawn;
  return new Promise((resolve, reject) => {
    let settled = false;
    let spawned;
    const finishError = error => {
      if (settled) return;
      settled = true;
      child = null;
      runningPath = '';
      reject(new Error('Could not start the desktop pet: ' + String(error?.message || error)));
    };
    try {
      spawned = spawnProcess(executable, [], { cwd: path.dirname(executable), windowsHide: false, shell: false, stdio: 'ignore', detached: false });
    } catch (error) { finishError(error); return; }
    spawned.once('error', finishError);
    spawned.once('spawn', () => {
      if (settled) return;
      settled = true;
      child = spawned;
      runningPath = executable;
      spawned.once('exit', () => { if (child === spawned) { child = null; runningPath = ''; } });
      resolve({ ok: true, alreadyRunning: false, executable });
    });
  });
}
function stop() {
  if (!child || child.exitCode !== null) { child = null; runningPath = ''; return { ok: true, stopped: false }; }
  const active = child;
  child = null;
  runningPath = '';
  try { active.kill(); return { ok: true, stopped: true }; }
  catch (error) { return { ok: false, stopped: false, error: String(error.message || error) }; }
}
module.exports = { EXE_NAME, candidates, locatePetExecutable, status, launch, stop };
