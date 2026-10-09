'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
let ffmpegPath = null;
let ffprobePath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch {}
try { ffprobePath = require('ffprobe-static').path; } catch {}

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
  const file = path.resolve(String(input || ''));
  await fs.access(file);
  if (!ffprobePath) throw new Error('FFprobe is unavailable.');
  return new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, ['-v','error','-show_format','-show_streams','-of','json',file], { windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err || 'ffprobe failed'));
      try { resolve(JSON.parse(out)); } catch (e) { reject(e); }
    });
  });
}
async function extractAudio(input, outputDir) {
  const source = path.resolve(String(input || ''));
  await fs.access(source);
  const dir = await ensureDir(outputDir);
  const target = path.join(dir, path.parse(source).name + '-audio.wav');
  await run(ffmpegPath, ['-y','-i',source,'-vn','-acodec','pcm_s16le','-ar','16000','-ac','1',target]);
  return { ok: true, output: target };
}
async function concat(inputs, outputDir, filename = 'export.mp4') {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 100) throw new Error('Choose between 1 and 100 media files.');
  const files = [];
  for (const item of inputs) { const p = path.resolve(String(item)); await fs.access(p); files.push(p); }
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
module.exports = { probe, extractAudio, concat, ensureDir, getCapabilities: () => ({ ffmpeg: !!ffmpegPath, ffprobe: !!ffprobePath }) };
