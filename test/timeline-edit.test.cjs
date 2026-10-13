'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('applies every supported timeline edit action with stable IDs and tracks', async () => {
  const { applyTimelineActions } = await import('../src/timeline-edit.mjs');
  const project = { title: 'Before', clips: [
    { id: 'video-a', type: 'video', file: 'a.mp4', timelineStart: 0, sourceStart: 0, duration: 8, track: 'Video 1' },
    { id: 'audio-a', type: 'audio', file: 'a.wav', timelineStart: 0, sourceStart: 0, duration: 4, track: 'Audio 1' },
    { id: 'caption-a', type: 'caption', file: '', text: 'Old title', timelineStart: 0, sourceStart: 0, duration: 2, track: 'Titles' }
  ] };
  const ids = ['caption-new', 'video-split'];
  const next = applyTimelineActions(project, [
    { type: 'rename_project', title: 'After' },
    { type: 'add_caption', text: 'Opening', start: 1, duration: 3 },
    { type: 'move_clip', clipId: 'video-a', start: 2, track: 'Video 2' },
    { type: 'set_duration', clipId: 'audio-a', duration: 3 },
    { type: 'set_source_start', clipId: 'audio-a', sourceStart: 1 },
    { type: 'split_clip', clipId: 'video-a', at: 5 },
    { type: 'remove_clip', clipId: 'caption-a' }
  ], () => ids.shift());
  assert.equal(next.title, 'After');
  assert.equal(next.clips.some(clip => clip.id === 'caption-a'), false);
  assert.equal(next.clips.find(clip => clip.id === 'audio-a').duration, 3);
  assert.equal(next.clips.find(clip => clip.id === 'audio-a').sourceStart, 1);
  assert.equal(next.clips.find(clip => clip.id === 'video-a').timelineStart, 2);
  assert.equal(next.clips.find(clip => clip.id === 'video-a').duration, 3);
  assert.equal(next.clips.find(clip => clip.id === 'video-split').timelineStart, 5);
  assert.equal(next.clips.find(clip => clip.id === 'caption-new').text, 'Opening');
  assert.equal(project.title, 'Before', 'source project must not be mutated');
});

test('rejects unknown IDs, invalid tracks, invalid boundaries, and duplicate generated IDs', async () => {
  const { applyTimelineActions } = await import('../src/timeline-edit.mjs');
  const project = { title: 'Test', clips: [{ id: 'v', type: 'video', file: 'v.mp4', timelineStart: 0, sourceStart: 0, duration: 4, track: 'Video 1' }] };
  const id = () => 'new-id';
  assert.throws(() => applyTimelineActions(project, [{ type: 'remove_clip', clipId: 'missing' }], id), /unknown/i);
  assert.throws(() => applyTimelineActions(project, [{ type: 'move_clip', clipId: 'v', start: 0, track: 'Audio 1' }], id), /cannot be moved/i);
  assert.throws(() => applyTimelineActions(project, [{ type: 'set_duration', clipId: 'v', duration: 3601 }], id), /between/i);
  assert.throws(() => applyTimelineActions(project, [{ type: 'set_source_start', clipId: 'v', sourceStart: 3600 }], id), /source trim/i);
  assert.throws(() => applyTimelineActions(project, [{ type: 'split_clip', clipId: 'v', at: 0 }], id), /between/i);
  assert.throws(() => applyTimelineActions(project, [{ type: 'add_caption', text: 'x', start: 3600, duration: 1 }], id), /bounds/i);
  assert.throws(() => applyTimelineActions(project, [{ type: 'add_caption', text: 'x', start: 0, duration: 1 }, { type: 'add_caption', text: 'y', start: 1, duration: 1 }], id), /duplicated/i);
});
