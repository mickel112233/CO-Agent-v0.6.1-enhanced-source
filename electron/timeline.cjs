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
  const clips = project.clips.map((clip, index) => {
    if (!clip || !TYPES.has(clip.type)) throw new Error('Clip ' + index + ' has an unsupported type.');
    const timelineStart = number(clip.timelineStart ?? 0, 'Clip timeline start', 0, MAX_DURATION);
    const duration = number(clip.duration ?? 5, 'Clip duration', 0.05, MAX_DURATION);
    const sourceStart = number(clip.sourceStart ?? 0, 'Clip source start', 0, MAX_DURATION);
    if (timelineStart + duration > MAX_DURATION) throw new Error('Project duration cannot exceed one hour.');
    const text = String(clip.text || '').slice(0, 500);
    const file = clip.type === 'caption' ? '' : path.resolve(String(clip.file || ''));
    if (clip.type !== 'caption' && (!clip.file || file.length > 2048)) throw new Error('Clip ' + index + ' requires a valid media file path.');
    return { id: String(clip.id || ('clip-' + index)).slice(0, 100), type: clip.type, file, timelineStart, duration, sourceStart, text, track: String(clip.track || (clip.type === 'audio' ? 'Audio 1' : clip.type === 'caption' ? 'Titles' : 'Video 1')).slice(0, 80) };
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
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  return { ok: true, path: file, project: normalizeProject(parsed) };
}
function escapeDrawtext(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%').replace(/,/g, '\\,').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}
function run(binary, args) {
  if (!binary) return Promise.reject(new Error('FFmpeg is unavailable.'));
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Timeline render timed out after 30 minutes.')); }, 30 * 60 * 1000);
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-10000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('FFmpeg render failed (' + code + '): ' + stderr.slice(-2000))); });
  });
}
async function render(project, outputDir, filename = 'co-agent-timeline.mp4') {
  const normalized = normalizeProject(project);
  const media = normalized.clips.filter(clip => clip.type !== 'caption').sort((a, b) => a.timelineStart - b.timelineStart || a.track.localeCompare(b.track));
  for (const clip of media) await fs.access(clip.file);
  const duration = Math.max(1, ...normalized.clips.map(clip => clip.timelineStart + clip.duration));
  if (duration > MAX_DURATION) throw new Error('Project duration cannot exceed one hour.');
  const dir = await ensureDir(outputDir);
  const output = path.join(dir, safeFilename(filename, 'co-agent-timeline.mp4'));
  const args = ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30:d=' + duration];
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
    graph.push('[' + index + ':v]trim=start=' + clip.sourceStart + ':duration=' + clip.duration + ',setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v' + stage + ']');
    graph.push('[' + base + '][v' + stage + ']overlay=eof_action=pass:shortest=0:enable=between(t\\,' + clip.timelineStart + '\\,' + (clip.timelineStart + clip.duration) + ')[' + next + ']');
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
  args.push('-movflags', '+faststart', output);
  await run(ffmpegPath, args);
  return { ok: true, output, duration, clips: normalized.clips.length };
}
module.exports = { normalizeProject, saveProject, loadProject, render, escapeDrawtext, MAX_CLIPS, MAX_DURATION };
