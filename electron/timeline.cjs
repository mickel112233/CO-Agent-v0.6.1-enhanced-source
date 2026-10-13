'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ensureDir } = require('./studio.cjs');
let ffmpegPath = null;
let ffprobePath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch {}
try { ffprobePath = require('ffprobe-static').path; } catch {}

const MAX_CLIPS = 120;
const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
const MAX_DURATION = 60 * 60;
const TYPES = new Set(['video', 'audio', 'image', 'caption']);
function number(value, label, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(label + ' must be between ' + min + ' and ' + max + '.');
  return n;
}
function safeFilename(value, fallback) {
  const name = path.basename(String(value || fallback)).replace(/[^a-zA-Z0-9._ -]/g, '_');
  return name || fallback;
}
function normalizeProject(project) {
  if (!project || typeof project !== 'object' || !Array.isArray(project.clips)) throw new Error('A project with a clips array is required.');
  if (project.clips.length > MAX_CLIPS) throw new Error('A project may contain at most ' + MAX_CLIPS + ' clips.');
  const seenIds = new Set();
  const clips = project.clips.map((clip, index) => {
    if (!clip || !TYPES.has(clip.type)) throw new Error('Clip ' + index + ' has an unsupported type.');
    const rawId = String(clip.id || ('clip-' + index)).slice(0, 100);
    if (!rawId.trim() || seenIds.has(rawId)) throw new Error('Clip IDs must be non-empty and unique. Duplicate ID: ' + rawId);
    seenIds.add(rawId);
    const timelineStart = number(clip.timelineStart ?? 0, 'Clip timeline start', 0, MAX_DURATION);
    const duration = number(clip.duration ?? 5, 'Clip duration', 0.05, MAX_DURATION);
    const sourceStart = number(clip.sourceStart ?? 0, 'Clip source start', 0, MAX_DURATION);
    if (timelineStart + duration > MAX_DURATION) throw new Error('Project duration cannot exceed one hour.');
    const text = String(clip.text || '').slice(0, 500);
    const file = clip.type === 'caption' ? '' : path.resolve(String(clip.file || ''));
    if (clip.type !== 'caption' && (!clip.file || file.length > 2048)) throw new Error('Clip ' + index + ' requires a valid media file path.');
    return { id: rawId, type: clip.type, file, timelineStart, duration, sourceStart, text, track: String(clip.track || (clip.type === 'audio' ? 'Audio 1' : clip.type === 'caption' ? 'Titles' : 'Video 1')).slice(0, 80) };
  });
  return { version: 1, title: String(project.title || 'Untitled project').slice(0, 160), width: 1280, height: 720, fps: 30, clips };
}
async function saveProject(filePath, project) {
  const file = path.resolve(String(filePath || ''));
  if (!file || !/\.coagent-project\.json$/i.test(file)) throw new Error('Project files must use the .coagent-project.json extension.');
  const normalized = normalizeProject(project);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(normalized, null, 2), 'utf8');
  return { ok: true, path: file, clips: normalized.clips.length };
}
async function loadProject(filePath) {
  const file = path.resolve(String(filePath || ''));
  if (!/\.coagent-project\.json$/i.test(file)) throw new Error('Choose a .coagent-project.json project file.');
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('Project path must point to a regular file.');
  if (stat.size > MAX_PROJECT_BYTES) throw new Error('Project file exceeds the 2 MB safety limit.');
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  return { ok: true, path: file, project: normalizeProject(parsed) };
}
function escapeDrawtext(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%').replace(/,/g, '\\,').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}
function run(binary, args, requestId) {
  if (!binary) return Promise.reject(new Error('FFmpeg is unavailable.'));
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '', settled = false;
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); if (activeRenders.get(requestId) === child) activeRenders.delete(requestId); error ? reject(error) : resolve(); };
    activeRenders.set(requestId, child);
    const timer = setTimeout(() => { child.kill(); finish(new Error('Timeline render timed out after 30 minutes.')); }, 30 * 60 * 1000);
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-10000); });
    child.on('error', error => finish(error));
    child.on('close', code => {
      if (child.__coAgentCancelled) finish(new Error('Timeline render cancelled by user.'));
      else if (code === 0) finish();
      else finish(new Error('FFmpeg render failed (' + code + '): ' + stderr.slice(-2000)));
    });
  });
}

function validateExportMetadata(metadata, fileSize) {
  if (!Number.isFinite(fileSize) || fileSize < 256) throw new Error('The export file is missing or unexpectedly small.');
  const streams = Array.isArray(metadata?.streams) ? metadata.streams : [];
  if (!streams.some(stream => stream?.codec_type === 'video')) throw new Error('The export contains no readable video stream.');
  const duration = Number(metadata?.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('The export has no valid duration metadata.');
  return { duration, hasAudio: streams.some(stream => stream?.codec_type === 'audio'), size: fileSize };
}
async function verifyRenderedOutput(output) {
  const stat = await fs.stat(output).catch(() => null);
  if (!stat?.isFile()) throw new Error('FFmpeg reported success, but the export file was not created.');
  if (!ffprobePath) throw new Error('FFprobe is unavailable, so CO-Agent cannot verify the exported video.');
  return new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', output], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Export verification timed out after 30 seconds.')); }, 30000);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 8 * 1024 * 1024) { child.kill(); finish(new Error('Export verification metadata exceeded the 8 MB limit.')); }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2000); });
    child.on('error', error => finish(error));
    child.on('close', code => {
      if (code !== 0) return finish(new Error('FFprobe could not read the export: ' + stderr.slice(-1000)));
      try { finish(null, validateExportMetadata(JSON.parse(stdout), stat.size)); }
      catch (error) { finish(error); }
    });
  });
}
async function render(project, outputDir, filename = 'co-agent-timeline.mp4', requestId = '') {
  const normalized = normalizeProject(project);
  const media = normalized.clips.filter(clip => clip.type !== 'caption').sort((a, b) => a.timelineStart - b.timelineStart || a.track.localeCompare(b.track));
  for (const clip of media) await fs.access(clip.file);
  const duration = Math.max(1, ...normalized.clips.map(clip => clip.timelineStart + clip.duration));
  if (duration > MAX_DURATION) throw new Error('Project duration cannot exceed one hour.');
  const dir = await ensureDir(outputDir);
  const output = path.join(dir, safeFilename(filename, 'co-agent-timeline.mp4'));
  const existing = await fs.lstat(output).catch(() => null);
  if (existing) throw new Error('An export already exists at this path. Choose a new filename so the existing export is preserved.');
  const jobId = String(requestId || ('timeline-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)));
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(jobId)) throw new Error('Timeline render request ID is invalid.');
  if (activeRenders.has(jobId)) throw new Error('A timeline render with this ID is already running.');
  const tempOutput = path.join(dir, '.' + path.basename(output, path.extname(output)) + '.' + Math.random().toString(36).slice(2, 10) + '.partial' + path.extname(output));
  const args = ['-n', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30:d=' + duration];
  const clipInputIndex = new Map();
  for (const clip of media) {
    const index = args.filter(arg => arg === '-i').length;
    if (clip.type === 'image') args.push('-loop', '1', '-t', String(clip.duration), '-i', clip.file);
    else args.push('-i', clip.file);
    clipInputIndex.set(clip.id, index);
  }
  const graph = [];
  let base = 'base0';
  graph.push('[0:v]setpts=PTS-STARTPTS[' + base + ']');
  let stage = 0;
  for (const clip of media.filter(item => item.type === 'video' || item.type === 'image')) {
    const index = clipInputIndex.get(clip.id);
    const next = 'base' + (++stage);
    graph.push('[' + index + ':v]trim=start=' + clip.sourceStart + ':duration=' + clip.duration + ',setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,setsar=1[v' + stage + ']');
    graph.push('[' + base + '][v' + stage + ']overlay=(W-w)/2:(H-h)/2:eof_action=pass:shortest=0:enable=between(t\\,' + clip.timelineStart + '\\,' + (clip.timelineStart + clip.duration) + ')[' + next + ']');
    base = next;
  }
  let captionIndex = 0;
  for (const clip of normalized.clips.filter(item => item.type === 'caption' && item.text.trim())) {
    const next = 'caption' + (++captionIndex);
    graph.push('[' + base + ']drawtext=text=\'' + escapeDrawtext(clip.text) + '\':fontcolor=white:fontsize=40:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-text_h-70:enable=between(t\\,' + clip.timelineStart + '\\,' + (clip.timelineStart + clip.duration) + ')[' + next + ']');
    base = next;
  }
  graph.push('[' + base + ']format=yuv420p[vout]');
  const audio = normalized.clips.filter(item => item.type === 'audio');
  let hasAudio = false;
  if (audio.length) {
    const audioLabels = [];
    audio.forEach((clip, i) => {
      const inputIndex = clipInputIndex.get(clip.id);
      const label = 'a' + i;
      graph.push('[' + inputIndex + ':a]atrim=start=' + clip.sourceStart + ':duration=' + clip.duration + ',asetpts=PTS-STARTPTS,volume=1,adelay=' + Math.round(clip.timelineStart * 1000) + '|' + Math.round(clip.timelineStart * 1000) + '[' + label + ']');
      audioLabels.push('[' + label + ']');
    });
    graph.push(audioLabels.join('') + 'amix=inputs=' + audioLabels.length + ':duration=longest:dropout_transition=0[aout]');
    hasAudio = true;
  }
  args.push('-filter_complex', graph.join(';'), '-map', '[vout]');
  if (hasAudio) args.push('-map', '[aout]');
  args.push('-t', String(duration), '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20');
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '192k');
  else args.push('-an');
  args.push('-movflags', '+faststart', tempOutput);
  try {
    await run(ffmpegPath, args, jobId);
    const verification = await verifyRenderedOutput(tempOutput);
    await fs.link(tempOutput, output);
    await fs.unlink(tempOutput);
    return { ok: true, output, duration, clips: normalized.clips.length, verified: true, fileSize: verification.size, hasAudio: verification.hasAudio, verifiedDuration: verification.duration };
  } finally { await fs.rm(tempOutput, { force: true }).catch(() => {}); }
}
function cancelRender(requestId) {
  const child = activeRenders.get(String(requestId || ''));
  if (!child) return { ok: true, cancelled: false };
  child.__coAgentCancelled = true;
  try { child.kill(); return { ok: true, cancelled: true }; }
  catch (error) { return { ok: false, cancelled: false, error: String(error.message || error) }; }
}
module.exports = { normalizeProject, saveProject, loadProject, render, cancelRender, escapeDrawtext, validateExportMetadata, MAX_CLIPS, MAX_PROJECT_BYTES, MAX_DURATION };
