'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
let ffmpegPath = null;
let ffprobePath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch {}
try { ffprobePath = require('ffprobe-static').path; } catch {}

function validateMediaPath(value, label = 'Media path') {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' is required.');
  if (value.length > 32768 || /[\x00-\x1f\x7f]/.test(value)) throw new Error(label + ' contains invalid control characters or is too long.');
  return path.resolve(value);
}
async function requireRegularFile(value, label = 'Media file') {
  const file = validateMediaPath(value, label);
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error(label + ' must be a regular file.');
  return file;
}
function safeName(value) {
  const name = path.basename(String(value || 'export.mp4')).replace(/[^a-zA-Z0-9._ -]/g, '_');
  return name || 'export.mp4';
}
async function ensureDir(dir) {
  const resolved = path.resolve(dir || path.join(os.homedir(), 'Videos', 'CO-Agent'));
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}
function run(binary, args, timeoutMs = 30 * 60 * 1000) {
  if (!binary) return Promise.reject(new Error('FFmpeg is unavailable. Reinstall dependencies or install FFmpeg and configure its path.'));
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore','ignore','pipe'] });
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Media process timed out.')); }, timeoutMs);
    child.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-12000); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve({ ok: true, stderr });
      else reject(new Error('FFmpeg exited with code ' + code + ': ' + stderr.slice(-2500)));
    });
  });
}
async function probe(input) {
  const file = await requireRegularFile(input, 'Media input');
  if (!ffprobePath) throw new Error('FFprobe is unavailable.');
  return new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, ['-v','error','-show_format','-show_streams','-of','json',file], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Media inspection timed out after 30 seconds.'));
    }, 30000);
    child.stdout.on('data', chunk => {
      out += chunk.toString();
      if (out.length > 8 * 1024 * 1024) {
        child.kill();
        finish(new Error('Media inspection output exceeded the 8 MB safety limit.'));
      }
    });
    child.stderr.on('data', chunk => { err = (err + chunk.toString()).slice(-4000); });
    child.on('error', error => finish(error));
    child.on('close', code => {
      if (code !== 0) return finish(new Error(err || 'ffprobe failed'));
      try { finish(null, JSON.parse(out)); } catch { finish(new Error('FFprobe returned invalid media metadata.')); }
    });
  });
}
async function extractAudio(input, outputDir) {
  const source = await requireRegularFile(input, 'Audio extraction input');
  const dir = await ensureDir(outputDir);
  const target = path.join(dir, path.parse(source).name + '-audio.wav');
  await run(ffmpegPath, ['-y','-i',source,'-vn','-acodec','pcm_s16le','-ar','16000','-ac','1',target]);
  return { ok: true, output: target };
}
async function concat(inputs, outputDir, filename = 'export.mp4') {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 100) throw new Error('Choose between 1 and 100 media files.');
  const files = [];
  for (const item of inputs) files.push(await requireRegularFile(item, 'Concat input'));
  const dir = await ensureDir(outputDir);
  const target = path.join(dir, safeName(filename));
  const list = path.join(dir, 'co-agent-concat-' + Date.now() + '.txt');
  const escaped = files.map(p => "file '" + p.replace(/\\/g, '/').replace(/'/g, "'\\''") + "'").join('\n');
  await fs.writeFile(list, escaped, 'utf8');
  try {
    await run(ffmpegPath, ['-y','-f','concat','-safe','0','-i',list,'-c','copy',target]);
  } finally { await fs.rm(list, { force: true }); }
  return { ok: true, output: target };
}
function buildSoundEffectArgs(preset, duration, outputPath) {
  const allowed = new Set(['impact', 'sweep', 'ambient', 'beep']);
  if (!allowed.has(preset)) throw new Error('Choose a supported sound-effect preset.');
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds < 0.25 || seconds > 12) throw new Error('Sound-effect duration must be between 0.25 and 12 seconds.');
  const output = validateMediaPath(outputPath, 'Sound-effect output path');
  const d = String(seconds);
  let source;
  if (preset === 'impact') source = 'anoisesrc=color=pink:amplitude=0.75:duration=' + d + ',lowpass=f=1800,afade=t=out:st=0.03:d=' + Math.max(0.1, seconds - 0.03);
  else if (preset === 'sweep') source = 'aevalsrc=0.55*sin(2*PI*(220*t+40*t*t)):s=48000:d=' + d + ',afade=t=out:st=' + Math.max(0, seconds - 0.2) + ':d=0.2';
  else if (preset === 'ambient') source = 'anoisesrc=color=pink:amplitude=0.12:duration=' + d + ',lowpass=f=900,afade=t=in:st=0:d=' + Math.min(0.25, seconds / 3) + ',afade=t=out:st=' + Math.max(0, seconds - 0.3) + ':d=' + Math.min(0.3, seconds / 3);
  else source = 'sine=frequency=880:sample_rate=48000:duration=' + d + ',afade=t=out:st=' + Math.max(0, seconds - 0.12) + ':d=' + Math.min(0.12, seconds);
  return { output, args: ['-y', '-f', 'lavfi', '-i', source, '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', output] };
}
async function generateSoundEffect({ preset = 'impact', duration = 2, outputPath } = {}) {
  const plan = buildSoundEffectArgs(preset, duration, outputPath);
  await fs.mkdir(path.dirname(plan.output), { recursive: true });
  await run(ffmpegPath, plan.args, 2 * 60 * 1000);
  const stat = await fs.stat(plan.output).catch(() => null);
  if (!stat?.isFile() || stat.size < 44) throw new Error('FFmpeg did not create a valid sound-effect WAV file.');
  return { ok: true, output: plan.output, preset, duration: Number(duration), bytes: stat.size, format: 'wav' };
}
module.exports = { probe, extractAudio, concat, generateSoundEffect, buildSoundEffectArgs, ensureDir, validateMediaPath, getCapabilities: () => ({ ffmpeg: !!ffmpegPath, ffprobe: !!ffprobePath }) };
