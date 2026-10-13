const MAX_DURATION = 3600;
const TRACKS = new Set(['Video 1', 'Video 2', 'Audio 1', 'Titles']);

function number(value, label, min, max) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(label + ' must be between ' + min + ' and ' + max + '.');
  return result;
}
function validTrack(clip, track) {
  if (!TRACKS.has(track)) return false;
  if (clip.type === 'audio') return track === 'Audio 1';
  if (clip.type === 'caption') return track === 'Titles';
  return ['video', 'image'].includes(clip.type) && ['Video 1', 'Video 2'].includes(track);
}
export function applyTimelineActions(project, actions, makeId) {
  if (!project || !Array.isArray(project.clips) || !Array.isArray(actions) || actions.length < 1 || actions.length > 12 || typeof makeId !== 'function') throw new Error('Timeline edit plan is invalid.');
  const next = { ...project, clips: project.clips.map(clip => ({ ...clip })) };
  const ids = new Set(next.clips.map(clip => clip.id));
  if (ids.size !== next.clips.length) throw new Error('Timeline clip IDs must be unique.');
  for (const action of actions) {
    if (!action || typeof action !== 'object') throw new Error('Timeline action is invalid.');
    if (action.type === 'rename_project') {
      const title = String(action.title || '').trim();
      if (!title || title.length > 120) throw new Error('Project title must contain 1–120 characters.');
      next.title = title;
      continue;
    }
    if (action.type === 'add_caption') {
      const text = String(action.text || '').trim();
      const start = number(action.start, 'Caption start', 0, MAX_DURATION);
      const duration = number(action.duration ?? 3, 'Caption duration', 0.05, 600);
      if (!text || text.length > 500 || start + duration > MAX_DURATION) throw new Error('Caption content or timeline bounds are invalid.');
      const id = String(makeId());
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || ids.has(id)) throw new Error('Generated caption ID is invalid or duplicated.');
      ids.add(id);
      next.clips.push({ id, type: 'caption', file: '', track: 'Titles', timelineStart: start, sourceStart: 0, duration, text });
      continue;
    }
    const index = next.clips.findIndex(clip => clip.id === action.clipId);
    if (index < 0) throw new Error('Timeline action references an unknown or already removed clip: ' + String(action.clipId || ''));
    const clip = next.clips[index];
    if (action.type === 'move_clip') {
      const start = number(action.start, 'Clip start', 0, MAX_DURATION);
      const track = String(action.track || '');
      if (start + clip.duration > MAX_DURATION) throw new Error('Moving this clip would exceed the one-hour timeline limit.');
      if (!validTrack(clip, track)) throw new Error('Clip type cannot be moved to track ' + track + '.');
      next.clips[index] = { ...clip, timelineStart: start, track };
    } else if (action.type === 'set_duration') {
      const duration = number(action.duration, 'Clip duration', 0.05, clip.type === 'caption' ? 600 : MAX_DURATION);
      if (clip.timelineStart + duration > MAX_DURATION || (clip.type !== 'caption' && clip.sourceStart + duration > MAX_DURATION)) throw new Error('Clip duration exceeds the project or source bounds.');
      next.clips[index] = { ...clip, duration };
    } else if (action.type === 'set_source_start') {
      if (clip.type === 'caption') throw new Error('Title clips do not have a media source to trim.');
      const sourceStart = number(action.sourceStart, 'Source start', 0, MAX_DURATION);
      if (sourceStart + clip.duration > MAX_DURATION) throw new Error('Source trim exceeds the one-hour safety bound.');
      next.clips[index] = { ...clip, sourceStart };
    } else if (action.type === 'remove_clip') {
      next.clips.splice(index, 1);
      ids.delete(clip.id);
    } else if (action.type === 'split_clip') {
      if (clip.type === 'caption') throw new Error('Title clips cannot be split by this action.');
      const at = number(action.at, 'Split point', clip.timelineStart + 0.051, clip.timelineStart + clip.duration - 0.051);
      const offset = at - clip.timelineStart;
      const newClipId = String(makeId());
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(newClipId) || ids.has(newClipId)) throw new Error('Generated split clip ID is invalid or duplicated.');
      ids.add(newClipId);
      next.clips.splice(index, 1,
        { ...clip, duration: offset },
        { ...clip, id: newClipId, timelineStart: at, sourceStart: clip.sourceStart + offset, duration: clip.duration - offset });
    } else throw new Error('Unsupported timeline action: ' + String(action.type));
  }
  if (next.clips.length > 120) throw new Error('Timeline cannot contain more than 120 clips.');
  return next;
}
