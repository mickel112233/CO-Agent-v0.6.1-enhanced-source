import React, { useMemo, useRef, useState } from 'react';
import { Film, Plus, Save, FolderOpen, Scissors, Trash2, ArrowLeft, ArrowRight, Music2, Image, Type, Video, Download, Clock3, Layers3, Undo2, Redo2, Sparkles, Check, X } from 'lucide-react';

const desktop = window.coAgent;
const TYPES = {
  video: { label: 'Video', icon: Video, extensions: ['mp4','mov','mkv','webm','avi','m4v'] },
  audio: { label: 'Audio', icon: Music2, extensions: ['mp3','wav','m4a','aac','ogg','flac'] },
  image: { label: 'Image', icon: Image, extensions: ['png','jpg','jpeg','webp','bmp'] }
};
const initialProject = () => ({ version: 1, title: 'Untitled project', clips: [] });
const baseName = value => String(value || '').split(/[\\/]/).pop();
const newId = () => 'clip-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

export default function TimelineEditor({ onBasic }) {
  const [project, setProject] = useState(initialProject);
  const projectRef = useRef(project);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [playhead, setPlayhead] = useState(0);
  const [assets, setAssets] = useState([]);
  const [captionText, setCaptionText] = useState('Your title here');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [filename, setFilename] = useState('co-agent-timeline.mp4');
  const [editPrompt, setEditPrompt] = useState('Add a clean opening title and move the first video clip to start at 1 second.');
  const [editPlan, setEditPlan] = useState(null);
  const [planningEdit, setPlanningEdit] = useState(false);
  const selected = project.clips.find(clip => clip.id === selectedId) || null;
  const duration = Math.max(10, ...project.clips.map(clip => clip.timelineStart + clip.duration));
  const orderedClips = useMemo(() => [...project.clips].sort((a, b) => a.timelineStart - b.timelineStart), [project.clips]);
  const tracks = ['Video 1', 'Video 2', 'Audio 1', 'Titles'];
  const applyProject = nextOrUpdater => {
    const previous = projectRef.current;
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater;
    if (next === previous) return;
    setUndoStack(old => [...old, previous].slice(-50));
    setRedoStack([]);
    projectRef.current = next;
    setProject(next);
  };
  const undo = () => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(old => [...old, projectRef.current].slice(-50));
    setUndoStack(old => old.slice(0, -1));
    projectRef.current = previous;
    setProject(previous);
    if (selectedId && !previous.clips.some(clip => clip.id === selectedId)) setSelectedId('');
    setNotice('Undo applied.');
  };
  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(old => [...old, projectRef.current].slice(-50));
    setRedoStack(old => old.slice(0, -1));
    projectRef.current = next;
    setProject(next);
    setNotice('Redo applied.');
  };
  const updateProject = updater => applyProject(old => ({ ...old, clips: updater(old.clips) }));
  const patchClip = (id, patch) => updateProject(clips => clips.map(clip => clip.id === id ? { ...clip, ...patch } : clip));

  async function importAssets() {
    try {
      const picked = await desktop.dialog.openFiles({ multiple: true, filters: [{ name: 'Media assets', extensions: [...new Set(Object.values(TYPES).flatMap(item => item.extensions))] }] });
      if (!Array.isArray(picked) || !picked.length) return;
      setAssets(old => [...new Set([...old, ...picked])]);
      setNotice('Imported ' + picked.length + ' asset(s). Select one and add it to the timeline.');
    } catch (error) { setNotice(error.message || String(error)); }
  }
  function inferType(file) {
    const ext = baseName(file).split('.').pop().toLowerCase();
    return Object.entries(TYPES).find(([, item]) => item.extensions.includes(ext))?.[0] || 'video';
  }
  function addAsset(file, track = inferType(file) === 'audio' ? 'Audio 1' : 'Video 1') {
    const type = inferType(file);
    if (type === 'audio' && !track.startsWith('Audio')) track = 'Audio 1';
    const previousEnd = Math.max(0, ...project.clips.filter(clip => clip.track === track).map(clip => clip.timelineStart + clip.duration));
    const clip = { id: newId(), type, file, track, timelineStart: Math.max(playhead, previousEnd), sourceStart: 0, duration: type === 'image' ? 5 : 5, text: '' };
    updateProject(clips => [...clips, clip]);
    setSelectedId(clip.id); setNotice(baseName(file) + ' added to ' + track + '. Set its duration and source trim before export.');
  }
  function addCaption() {
    const clip = { id: newId(), type: 'caption', file: '', track: 'Titles', timelineStart: playhead, sourceStart: 0, duration: 3, text: captionText };
    updateProject(clips => [...clips, clip]); setSelectedId(clip.id);
  }
  function splitSelected() {
    if (!selected) return;
    const splitAt = playhead - selected.timelineStart;
    if (splitAt <= 0.05 || splitAt >= selected.duration - 0.05) { setNotice('Move the playhead inside the selected clip before splitting.'); return; }
    const first = { ...selected, duration: splitAt };
    const second = { ...selected, id: newId(), timelineStart: playhead, sourceStart: selected.sourceStart + splitAt, duration: selected.duration - splitAt };
    updateProject(clips => clips.flatMap(clip => clip.id === selected.id ? [first, second] : [clip]));
    setSelectedId(second.id); setNotice('Clip split at ' + playhead.toFixed(1) + ' seconds.');
  }
  function removeSelected() {
    if (!selected) return;
    updateProject(clips => clips.filter(clip => clip.id !== selected.id)); setSelectedId('');
  }

  async function planTimelineEdit() {
    const instruction = editPrompt.trim();
    if (!instruction || planningEdit || busy) return;
    setPlanningEdit(true); setEditPlan(null); setNotice('');
    try {
      const snapshot = { title: project.title, clips: project.clips.map(({ id, type, track, timelineStart, sourceStart, duration, text, file }) => ({ id, type, track, timelineStart, sourceStart, duration, text, name: baseName(file) })) };
      const prompt = [
        'You are the timeline-edit planner for CO-Agent Video Studio.',
        'Return ONLY a JSON object exactly shaped as {"actions":[...],"summary":"..."} with at most 12 actions. Do not return markdown.',
        'Allowed actions: {"type":"rename_project","title":"..."}; {"type":"add_caption","text":"...","start":number,"duration":number}; {"type":"move_clip","clipId":"existing id","start":number,"track":"Video 1"|"Video 2"|"Audio 1"|"Titles"}; {"type":"set_duration","clipId":"existing id","duration":number}; {"type":"set_source_start","clipId":"existing id","sourceStart":number}; {"type":"remove_clip","clipId":"existing id"}; {"type":"split_clip","clipId":"existing id","at":number} where at is timeline seconds.',
        'Never invent clip IDs. Use only existing IDs from the project. Times must be non-negative. Keep captions at most 500 characters and project titles at most 120 characters. Do not invent file paths or run/export anything.',
        'Project state JSON: ' + JSON.stringify(snapshot),
        'User request: ' + instruction
      ].join('\n\n');
      const result = await desktop.runtime.chat({ requestId: 'timeline-' + Date.now().toString(36), provider: 'ollama', messages: [{ role: 'user', content: prompt }] });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Timeline planner failed.');
      const raw = String(result.message || '').trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.actions) || parsed.actions.length < 1 || parsed.actions.length > 12) throw new Error('The model did not return a valid plan with 1–12 actions.');
      const tracksAllowed = ['Video 1', 'Video 2', 'Audio 1', 'Titles'];
      const safe = parsed.actions.map(action => {
        if (!action || typeof action !== 'object') throw new Error('The plan contains an invalid action.');
        if (action.type === 'rename_project') {
          const title = String(action.title || '').trim().slice(0, 120);
          if (!title) throw new Error('The plan contains an empty project title.');
          return { type: action.type, title };
        }
        if (action.type === 'add_caption') {
          const text = String(action.text || '').trim().slice(0, 500), start = Number(action.start), duration = Number(action.duration ?? 3);
          if (!text || !Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error('The plan contains an invalid caption.');
          return { type: action.type, text, start, duration };
        }
        const clip = projectRef.current.clips.find(item => item.id === action.clipId);
        if (!clip) throw new Error('The plan references a clip that is no longer in the timeline.');
        if (action.type === 'move_clip') {
          const start = Number(action.start), track = String(action.track || '');
          if (!Number.isFinite(start) || start < 0 || start > 86400 || !tracksAllowed.includes(track)) throw new Error('The plan contains an invalid clip move.');
          if (clip.type === 'audio' && !track.startsWith('Audio')) throw new Error('Audio clips can only move to audio tracks.');
          if (clip.type === 'caption' && track !== 'Titles') throw new Error('Title clips must remain on the Titles track.');
          if (['video','image'].includes(clip.type) && track.startsWith('Audio')) throw new Error('Visual clips cannot move to audio tracks.');
          return { type: action.type, clipId: clip.id, start, track };
        }
        if (action.type === 'set_duration') {
          const duration = Number(action.duration);
          if (!Number.isFinite(duration) || duration <= 0 || duration > 86400) throw new Error('The plan contains an invalid duration.');
          return { type: action.type, clipId: clip.id, duration };
        }
        if (action.type === 'set_source_start') {
          const sourceStart = Number(action.sourceStart);
          if (!Number.isFinite(sourceStart) || sourceStart < 0 || sourceStart > 86400) throw new Error('The plan contains an invalid source trim.');
          return { type: action.type, clipId: clip.id, sourceStart };
        }
        if (action.type === 'remove_clip') return { type: action.type, clipId: clip.id };
        if (action.type === 'split_clip') {
          const at = Number(action.at);
          if (!Number.isFinite(at) || at <= clip.timelineStart + 0.05 || at >= clip.timelineStart + clip.duration - 0.05) throw new Error('A split must fall inside the selected clip.');
          return { type: action.type, clipId: clip.id, at };
        }
        throw new Error('Unsupported timeline action: ' + String(action.type));
      });
      setEditPlan({ actions: safe, summary: String(parsed.summary || 'Review the proposed timeline edits below.').slice(0, 500) });
    } catch (error) { setNotice('Could not plan timeline edits: ' + (error.message || String(error))); }
    finally { setPlanningEdit(false); }
  }
  function applyTimelineEditPlan() {
    if (!editPlan) return;
    const idMap = new Map();
    const actions = editPlan.actions;
    updateProject(clips => {
      let next = [...clips];
      for (const action of actions) {
        if (action.type === 'rename_project') continue;
        if (action.type === 'add_caption') {
          const id = newId(); idMap.set(id, id);
          next.push({ id, type: 'caption', file: '', track: 'Titles', timelineStart: action.start, sourceStart: 0, duration: action.duration, text: action.text });
        } else if (action.type === 'move_clip') next = next.map(clip => clip.id === action.clipId ? { ...clip, timelineStart: action.start, track: action.track } : clip);
        else if (action.type === 'set_duration') next = next.map(clip => clip.id === action.clipId ? { ...clip, duration: action.duration } : clip);
        else if (action.type === 'set_source_start') next = next.map(clip => clip.id === action.clipId ? { ...clip, sourceStart: action.sourceStart } : clip);
        else if (action.type === 'remove_clip') next = next.filter(clip => clip.id !== action.clipId);
        else if (action.type === 'split_clip') {
          const clip = next.find(item => item.id === action.clipId);
          if (!clip) continue;
          const offset = action.at - clip.timelineStart;
          next = next.flatMap(item => item.id !== clip.id ? [item] : [
            { ...item, duration: offset },
            { ...item, id: newId(), timelineStart: action.at, sourceStart: item.sourceStart + offset, duration: item.duration - offset }
          ]);
        }
      }
      return next;
    });
    const rename = actions.find(action => action.type === 'rename_project');
    if (rename) {
      const next = { ...projectRef.current, title: rename.title };
      projectRef.current = next; setProject(next);
    }
    setEditPlan(null); setNotice('Applied ' + actions.length + ' timeline edit(s). Use Undo to revert the entire plan.');
  }

  async function saveProject() {
    setBusy('save'); setNotice('');
    try {
      const path = await desktop.dialog.saveFile({ defaultPath: (project.title || 'untitled').replace(/[^a-z0-9-_ ]/gi, '_') + '.coagent-project.json' });
      if (!path) return;
      const result = await desktop.studio.saveProject({ path, project });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Project save failed.');
      setNotice('Project saved: ' + result.path);
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }
  async function loadProject() {
    setBusy('load'); setNotice('');
    try {
      const picked = await desktop.dialog.openFiles({ multiple: false, filters: [{ name: 'CO-Agent project', extensions: ['coagent-project.json'] }] });
      if (!picked?.length) return;
      const result = await desktop.studio.loadProject({ path: picked[0] });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Project load failed.');
      applyProject(result.project); setSelectedId(result.project.clips[0]?.id || ''); setAssets(old => [...new Set([...old, ...result.project.clips.filter(c => c.file).map(c => c.file)])]);
      setNotice('Loaded ' + result.project.title + ' (' + result.project.clips.length + ' clips).');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }
  async function exportTimeline() {
    setBusy('render'); setNotice('');
    try {
      let dir = outputDir;
      if (!dir) { dir = await desktop.dialog.chooseDirectory(); if (!dir) return; setOutputDir(dir); }
      const result = await desktop.studio.renderTimeline({ project, outputDir: dir, filename });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Render failed.');
      setNotice('Render complete: ' + result.output + ' (' + result.duration.toFixed(1) + ' sec).');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }
  const previewUrl = selected?.file ? (selected.file.startsWith('file:') ? selected.file : 'file://' + selected.file.replace(/\\/g, '/')) : '';
  const PreviewIcon = selected?.type === 'audio' ? Music2 : selected?.type === 'image' ? Image : Film;

  return <section className="timeline-editor-view">
    <div className="timeline-editor-heading"><div><p className="eyebrow">NON-LINEAR EDITING</p><h1>Video Studio</h1><p className="subhead">Arrange video, image, audio, and title clips across independent tracks. Save editable projects and render an MP4 locally with FFmpeg.</p></div><div className="timeline-heading-actions"><button className="secondary-button" onClick={onBasic}><Layers3 size={14}/> Basic tools</button><button className="secondary-button" onClick={loadProject} disabled={!!busy}><FolderOpen size={14}/> Open project</button><button className="primary-button" onClick={saveProject} disabled={!!busy}><Save size={14}/> Save project</button></div></div>
    <div className="timeline-ai-edit-panel">
      <div className="panel-heading"><strong><Sparkles size={15}/> Edit timeline with AI</strong><span>Local Ollama · review before applying</span></div>
      <p>Describe edits in plain English. CO-Agent proposes a constrained action plan; nothing changes until you approve it.</p>
      <div className="timeline-ai-edit-controls"><textarea value={editPrompt} onChange={event => setEditPrompt(event.target.value)} rows={2} maxLength={2000} placeholder="e.g. Add a title at the start, move clip 2 to 5 seconds, and trim clip 1 to 8 seconds."/><button className="primary-button" onClick={planTimelineEdit} disabled={planningEdit || !!busy || !editPrompt.trim()}>{planningEdit ? 'Planning…' : 'Plan edits'}</button></div>
      {editPlan && <div className="timeline-ai-plan"><div><strong>{editPlan.summary}</strong><span>{editPlan.actions.length} proposed action(s)</span></div><ol>{editPlan.actions.map((action, index) => <li key={index}>{action.type === 'rename_project' ? 'Rename project to “' + action.title + '”' : action.type === 'add_caption' ? 'Add title at ' + action.start + 's: “' + action.text + '”' : action.type === 'move_clip' ? 'Move ' + action.clipId + ' to ' + action.start + 's on ' + action.track : action.type === 'set_duration' ? 'Set ' + action.clipId + ' duration to ' + action.duration + 's' : action.type === 'set_source_start' ? 'Trim source start of ' + action.clipId + ' to ' + action.sourceStart + 's' : action.type === 'remove_clip' ? 'Remove ' + action.clipId : 'Split ' + action.clipId + ' at ' + action.at + 's'}</li>)}</ol><div className="timeline-ai-plan-actions"><button className="secondary-button" onClick={() => setEditPlan(null)}><X size={14}/> Discard</button><button className="primary-button" onClick={applyTimelineEditPlan} disabled={!!busy}><Check size={14}/> Apply approved edits</button></div></div>}
    </div>
    <div className="timeline-toolbar"><button className="secondary-button" onClick={importAssets} disabled={!!busy}><Plus size={14}/> Import media</button><button className="secondary-button timeline-history-button" onClick={undo} disabled={!undoStack.length || !!busy} title="Undo last timeline edit"><Undo2 size={14}/> Undo</button><button className="secondary-button timeline-history-button" onClick={redo} disabled={!redoStack.length || !!busy} title="Redo timeline edit"><Redo2 size={14}/> Redo</button><label className="timeline-project-name">Project title<input value={project.title} onChange={e => { const title = e.target.value; const next = { ...projectRef.current, title }; projectRef.current = next; setProject(next); setUndoStack(old => old.map(item => ({ ...item, title }))); setRedoStack(old => old.map(item => ({ ...item, title }))); }}/></label><span className="timeline-duration"><Clock3 size={14}/> {duration.toFixed(1)}s timeline</span><span className="timeline-duration">{project.clips.length} clips</span></div>
    <div className="timeline-workspace">
      <aside className="timeline-assets"><div className="panel-heading"><strong><FolderOpen size={15}/> Media assets</strong><span>{assets.length}</span></div>{assets.length ? assets.map(file => { const Icon = TYPES[inferType(file)]?.label === 'Audio' ? Music2 : TYPES[inferType(file)]?.label === 'Image' ? Image : Film; return <div className="timeline-asset" key={file}><Icon size={15}/><span title={file}>{baseName(file)}</span><button title="Add to timeline" onClick={() => addAsset(file)}><Plus size={14}/></button></div>; }) : <div className="timeline-asset-empty">Import video, audio, or image assets to begin.</div>}
        <div className="timeline-caption-add"><label>Title / caption<textarea value={captionText} onChange={e => setCaptionText(e.target.value)} maxLength={500}/></label><button className="secondary-button" onClick={addCaption} disabled={!captionText.trim()}><Type size={14}/> Add title at playhead</button></div>
      </aside>
      <div className="timeline-main">
        <div className="timeline-preview">
          <div className="timeline-preview-canvas">{selected?.type === 'video' && previewUrl ? <video key={selected.id} src={previewUrl} controls /> : selected?.type === 'audio' ? <div className="timeline-audio-preview"><Music2 size={30}/><span>{baseName(selected.file)}</span>{previewUrl && <audio src={previewUrl} controls/>}</div> : selected?.type === 'image' && previewUrl ? <img src={previewUrl} alt={baseName(selected.file)}/> : selected?.type === 'caption' ? <div className="timeline-title-preview">{selected.text}</div> : <div className="timeline-no-preview"><Film size={32}/><span>Select a timeline clip to inspect it.</span></div>}</div>
          <div className="timeline-transport"><span><Clock3 size={14}/> Playhead {playhead.toFixed(1)}s</span><input aria-label="Timeline playhead" type="range" min="0" max={duration} step=".1" value={Math.min(playhead,duration)} onChange={e => setPlayhead(Number(e.target.value))}/><button className="secondary-button" disabled={!selected} onClick={splitSelected}><Scissors size={14}/> Split at playhead</button></div>
        </div>
        <div className="timeline-ruler"><span>0s</span>{Array.from({length: Math.min(10, Math.ceil(duration / 5))}, (_, i) => <span key={i}>{((i + 1) * duration / Math.min(10, Math.ceil(duration / 5))).toFixed(0)}s</span>)}</div>
        <div className="timeline-tracks">{tracks.map(track => <div className="timeline-track-row" key={track}><div className="timeline-track-label">{track}</div><div className="timeline-track-lane" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const rect = e.currentTarget.getBoundingClientRect(); const at = Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration)); if (id) patchClip(id, { timelineStart: at, track }); else setPlayhead(at); }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); setPlayhead(Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration))); }}><div className="timeline-playhead" style={{left: (playhead / duration * 100) + '%'}}/>{orderedClips.filter(clip => clip.track === track).map(clip => <button key={clip.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', clip.id); e.dataTransfer.effectAllowed = 'move'; }} className={'timeline-clip-block ' + clip.type + (clip.id === selectedId ? ' selected' : '')} style={{left: (clip.timelineStart / duration * 100) + '%', width: Math.max(1.5, clip.duration / duration * 100) + '%'}} onClick={e => { e.stopPropagation(); setSelectedId(clip.id); setPlayhead(clip.timelineStart); }} title="Drag to reposition or move to another track"><span>{clip.type === 'caption' ? clip.text : baseName(clip.file)}</span></button>)}</div></div>)}</div>
      </div>
    </div>
    <div className="timeline-inspector"><div className="panel-heading"><strong><Layers3 size={15}/> Clip inspector</strong><span>{selected ? selected.type + ' · ' + selected.track : 'No clip selected'}</span></div>{selected ? <div className="timeline-inspector-fields"><label>Track<select value={selected.track} onChange={e => patchClip(selected.id, { track: e.target.value })}>{tracks.map(track => <option key={track}>{track}</option>)}</select></label><label>Timeline start (s)<input type="number" min="0" step=".1" value={selected.timelineStart} onChange={e => patchClip(selected.id, { timelineStart: Math.max(0, Number(e.target.value) || 0) })}/></label><label>Source in (s)<input type="number" min="0" step=".1" value={selected.sourceStart} onChange={e => patchClip(selected.id, { sourceStart: Math.max(0, Number(e.target.value) || 0) })}/></label><label>Duration (s)<input type="number" min=".1" step=".1" value={selected.duration} onChange={e => patchClip(selected.id, { duration: Math.max(.1, Number(e.target.value) || .1) })}/></label>{selected.type === 'caption' && <label className="timeline-caption-field">Caption text<input value={selected.text} onChange={e => patchClip(selected.id, { text: e.target.value })}/></label>}<div className="timeline-edit-buttons"><button className="secondary-button" onClick={() => patchClip(selected.id, { timelineStart: Math.max(0, selected.timelineStart - 1) })}><ArrowLeft size={14}/> Move −1s</button><button className="secondary-button" onClick={() => patchClip(selected.id, { timelineStart: selected.timelineStart + 1 })}><ArrowRight size={14}/> Move +1s</button><button className="secondary-button" onClick={() => patchClip(selected.id, { sourceStart: Math.max(0, selected.sourceStart - .5), duration: selected.duration + .5 })}>Extend start −0.5s</button><button className="secondary-button" onClick={() => patchClip(selected.id, { sourceStart: selected.sourceStart + .5, duration: Math.max(.1, selected.duration - .5) })}>Trim start +0.5s</button><button className="secondary-button" onClick={() => patchClip(selected.id, { duration: Math.max(.1, selected.duration - .5) })}>Trim end −0.5s</button><button className="secondary-button danger" onClick={removeSelected}><Trash2 size={14}/> Remove clip</button></div></div> : <p className="timeline-inspector-empty">Select a clip block to change its track, timing, trim, or title text.</p>}</div>
    <div className="timeline-export"><div><strong>Export timeline</strong><p>FFmpeg renders video/image overlays and title cards, plus audio clips on the Audio 1 track. This is a functional editor foundation; transitions, keyframes, color grading, and waveform rendering are not included yet.</p></div><div className="timeline-export-controls"><label>Filename<input value={filename} onChange={e => setFilename(e.target.value)} /></label><button className="secondary-button" onClick={async () => { const dir = await desktop.dialog.chooseDirectory(); if (dir) setOutputDir(dir); }}><FolderOpen size={14}/>{outputDir ? baseName(outputDir) : 'Output folder'}</button><button className="primary-button" disabled={!!busy || !project.clips.length} onClick={exportTimeline}><Download size={14}/>{busy === 'render' ? 'Rendering…' : 'Render MP4'}</button></div></div>
    {notice && <p className="studio-notice" role="status">{notice}</p>}
    <p className="computer-footnote">Project files store source paths, trim points, track assignment, captions, and timeline positions. Media remains in its original location; keep source files available when reopening a project.</p>
  </section>;
}
