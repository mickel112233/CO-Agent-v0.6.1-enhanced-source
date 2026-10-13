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

export default function TimelineEditor({ onTools, chatConfig = { provider: 'ollama' } }) {
  const [project, setProject] = useState(initialProject);
  const projectRef = useRef(project);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [playhead, setPlayhead] = useState(0);
  const [assets, setAssets] = useState([]);
  const [captionText, setCaptionText] = useState('Your title here');
  const [busy, setBusy] = useState('');
  const renderRequestRef = useRef('');
  const [notice, setNotice] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [filename, setFilename] = useState('co-agent-timeline.mp4');
  const [editPrompt, setEditPrompt] = useState('');
  const [editPlan, setEditPlan] = useState(null);
  const [planningEdit, setPlanningEdit] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceReference, setVoiceReference] = useState('');
  const [voiceStatus, setVoiceStatus] = useState({ installed: false, ffprobeReady: false, message: 'Checking LuxTTS…' });
  const [soundPreset, setSoundPreset] = useState('impact');
  const [soundDuration, setSoundDuration] = useState(2);
  const [generationProgress, setGenerationProgress] = useState('');

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

  async function refreshVoiceStatus() {
    try {
      const [status, capabilities] = await Promise.all([desktop?.luxTTS?.status?.(), desktop?.studio?.getCapabilities?.()]);
      if (status) setVoiceStatus({ ...status, ffprobeReady: Boolean(capabilities?.ffprobe), message: capabilities?.ffprobe ? status.message : 'FFprobe is required to verify generated WAV files before they enter the timeline.' });
    } catch (error) { setVoiceStatus({ installed: false, ffprobeReady: false, message: error.message || String(error) }); }
  }
  React.useEffect(() => {
    refreshVoiceStatus();
    const unsubscribe = desktop?.luxTTS?.onGenerationProgress?.(event => setGenerationProgress(event?.message || event?.stage || 'Generating…'));
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);
  async function chooseVoiceReference() {
    try {
      const picked = await desktop.dialog.openFiles({ multiple: false, filters: [{ name: 'Reference voice audio', extensions: ['wav','mp3','m4a','flac','ogg'] }] });
      if (picked?.[0]) setVoiceReference(picked[0]);
    } catch (error) { setNotice(error.message || String(error)); }
  }
  async function generateVoiceover() {
    if (!voiceText.trim()) { setNotice('Enter the voiceover text first.'); return; }
    if (!voiceReference) { setNotice('Choose a reference voice recording first. LuxTTS uses it for voice cloning.'); return; }
    setBusy('voice'); setNotice('Generating local LuxTTS voiceover…');
    try {
      const dir = outputDir || await desktop.dialog.chooseDirectory();
      if (!dir) return;
      if (!outputDir) setOutputDir(dir);
      const sep = dir.includes('\\') ? '\\' : '/';
      const target = dir.replace(/[\\/]+$/, '') + sep + 'co-agent-voiceover-' + Date.now() + '.wav';
      const result = await desktop.luxTTS.generate({ text: voiceText.trim(), referenceAudio: voiceReference, outputPath: target, requestId: 'studio-tts-' + Date.now().toString(36), numSteps: 4, speed: 1 });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'LuxTTS generation failed.');
      setAssets(old => [...new Set([...old, result.output])]);
      addAsset(result.output, 'Audio 1');
      setNotice('Voiceover generated and added to Audio 1: ' + result.output);
      setGenerationProgress('');
    } catch (error) { setNotice('Voiceover generation failed: ' + (error.message || String(error))); }
    finally { setBusy(''); }
  }
  async function generateSoundEffect() {
    setBusy('sound'); setNotice('Generating a local sound effect with FFmpeg…');
    try {
      const dir = outputDir || await desktop.dialog.chooseDirectory();
      if (!dir) return;
      if (!outputDir) setOutputDir(dir);
      const sep = dir.includes('\\') ? '\\' : '/';
      const target = dir.replace(/[\\/]+$/, '') + sep + 'co-agent-sfx-' + soundPreset + '-' + Date.now() + '.wav';
      const result = await desktop.studio.generateSoundEffect({ preset: soundPreset, duration: soundDuration, outputPath: target });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Sound effect generation failed.');
      setAssets(old => [...new Set([...old, result.output])]);
      addAsset(result.output, 'Audio 1');
      setNotice('Generated sound effect added to Audio 1: ' + result.output);
    } catch (error) { setNotice('Sound effect generation failed: ' + (error.message || String(error))); }
    finally { setBusy(''); }
  }

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
      const baseSignature = JSON.stringify(projectRef.current);
      const snapshot = { title: project.title, clips: project.clips.map(({ id, type, track, timelineStart, sourceStart, duration, text, file }) => ({ id, type, track, timelineStart, sourceStart, duration, text, name: baseName(file) })) };
      const prompt = [
        'You are the timeline-edit planner for CO-Agent Video Studio. Interpret the user request as natural-language editing intent.',
        'Return ONLY a JSON object exactly shaped as {"actions":[...],"summary":"..."} with at most 12 actions. Do not return markdown. If the request is ambiguous or requires unavailable assets, return an empty actions array and explain the missing information in summary.',
        'Allowed actions: {"type":"rename_project","title":"..."}; {"type":"add_caption","text":"...","start":number,"duration":number}; {"type":"move_clip","clipId":"existing id","start":number,"track":"Video 1"|"Video 2"|"Audio 1"|"Titles"}; {"type":"set_duration","clipId":"existing id","duration":number}; {"type":"set_source_start","clipId":"existing id","sourceStart":number}; {"type":"remove_clip","clipId":"existing id"}; {"type":"split_clip","clipId":"existing id","at":number} where at is timeline seconds.',
        'Never invent clip IDs. Use only existing IDs from the project. Times must be non-negative. Keep captions at most 500 characters and project titles at most 120 characters. Do not invent file paths or run/export anything.',
        'Project state JSON: ' + JSON.stringify(snapshot),
        'User request: ' + instruction
      ].join('\n\n');
      const selectedProvider = chatConfig?.provider === 'api' ? 'api' : 'ollama';
      if (selectedProvider === 'api' && !String(chatConfig?.apiKey || '').trim()) throw new Error('Add your Cloud API key in Models & settings before planning timeline edits.');
      const result = await desktop.runtime.chat({
        ...(selectedProvider === 'api' ? { provider: 'api', providerConfig: chatConfig.providerConfig, apiKey: chatConfig.apiKey } : { provider: 'ollama', model: String(chatConfig?.model || '').trim() }),
        requestId: 'timeline-' + Date.now().toString(36),
        messages: [{ role: 'user', content: prompt }]
      });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Timeline planner failed.');
      const raw = String(result.message || '').trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.actions) || parsed.actions.length > 12) throw new Error('The model did not return a valid plan with at most 12 actions.');
      if (parsed.actions.length === 0) { setNotice(String(parsed.summary || 'The request needs more information before it can be applied.')); return; }
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
          if (!text || !Number.isFinite(start) || start < 0 || start > 3600 || !Number.isFinite(duration) || duration <= 0 || duration > 600 || start + duration > 3600) throw new Error('The plan contains an invalid caption. Timeline edits must remain within the one-hour project limit.');
          return { type: action.type, text, start, duration };
        }
        const clip = projectRef.current.clips.find(item => item.id === action.clipId);
        if (!clip) throw new Error('The plan references a clip that is no longer in the timeline.');
        if (action.type === 'move_clip') {
          const start = Number(action.start), track = String(action.track || '');
          if (!Number.isFinite(start) || start < 0 || start > 3600 || start + clip.duration > 3600 || !tracksAllowed.includes(track)) throw new Error('The plan contains an invalid clip move. Timeline edits must remain within the one-hour project limit.');
          if (clip.type === 'audio' && track !== 'Audio 1') throw new Error('Audio clips can only move to the Audio 1 track.');
          if (clip.type === 'caption' && track !== 'Titles') throw new Error('Title clips must remain on the Titles track.');
          if (['video','image'].includes(clip.type) && !['Video 1', 'Video 2'].includes(track)) throw new Error('Video and image clips can only move to video tracks.');
          return { type: action.type, clipId: clip.id, start, track };
        }
        if (action.type === 'set_duration') {
          const duration = Number(action.duration);
          if (!Number.isFinite(duration) || duration <= 0 || duration > 3600 || clip.timelineStart + duration > 3600) throw new Error('The plan contains an invalid duration. Timeline edits must remain within the one-hour project limit.');
          if (clip.type === 'caption' && duration > 600) throw new Error('Title duration cannot exceed 600 seconds.');
          return { type: action.type, clipId: clip.id, duration };
        }
        if (action.type === 'set_source_start') {
          const sourceStart = Number(action.sourceStart);
          if (clip.type === 'caption') throw new Error('Title clips do not have a media source to trim.');
          if (!Number.isFinite(sourceStart) || sourceStart < 0 || sourceStart > 3600 || sourceStart + clip.duration > 3600) throw new Error('The plan contains an invalid source trim. Timeline edits must remain within the one-hour project limit.');
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
      const removedIds = new Set(safe.filter(action => action.type === 'remove_clip').map(action => action.clipId));
      if (safe.some(action => action.clipId && removedIds.has(action.clipId) && action.type !== 'remove_clip')) throw new Error('The plan edits a clip after removing it. Ask for a simpler plan and try again.');
      const splitIds = safe.filter(action => action.type === 'split_clip').map(action => action.clipId);
      if (new Set(splitIds).size !== splitIds.length) throw new Error('The plan splits the same clip more than once; review a simpler plan.');
      setEditPlan({ actions: safe, baseSignature, summary: String(parsed.summary || 'Review the proposed timeline edits below.').slice(0, 500) });
    } catch (error) { setNotice('Could not plan timeline edits: ' + (error.message || String(error))); }
    finally { setPlanningEdit(false); }
  }
  function applyTimelineEditPlan() {
    if (!editPlan) return;
    if (JSON.stringify(projectRef.current) !== editPlan.baseSignature) {
      setEditPlan(null);
      setNotice('Timeline changed while the plan was open. The stale plan was discarded; generate a fresh plan.');
      return;
    }
    try {
      const next = applyTimelineActions(projectRef.current, editPlan.actions, newId);
      applyProject(next);
      setEditPlan(null);
      setNotice('Applied ' + editPlan.actions.length + ' timeline edit(s). Use Undo to revert the entire plan.');
    } catch (error) {
      setNotice('The edit plan was not applied: ' + (error.message || String(error)));
    }
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
    if (!project.clips.length) return;
    let dir = outputDir;
    if (!dir) { dir = await desktop.dialog.chooseDirectory(); if (!dir) return; setOutputDir(dir); }
    const requestId = 'timeline-render-' + Date.now().toString(36);
    renderRequestRef.current = requestId;
    setBusy('render'); setNotice('Rendering and verifying MP4…');
    try {
      const result = await desktop.studio.renderTimeline({ project, outputDir: dir, filename, requestId });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Timeline render failed.');
      setNotice('Export verified: ' + result.output + ' (' + (result.fileSize / 1e6).toFixed(1) + ' MB)');
    } catch (error) {
      setNotice(/cancel/i.test(error.message || '') ? 'Export cancelled. Any partial output was removed; existing exports were preserved.' : 'Export failed: ' + (error.message || String(error)));
    } finally { renderRequestRef.current = ''; setBusy(''); }
  }
  async function cancelTimelineExport() {
    const requestId = renderRequestRef.current;
    if (!requestId) return;
    try {
      const result = await desktop.studio.cancelTimelineRender(requestId);
      setNotice(result?.cancelled ? 'Stopping export…' : 'No active export was found.');
    } catch (error) { setNotice('Could not cancel export: ' + (error.message || String(error))); }
  }

  const previewUrl = selected?.file ? (selected.file.startsWith('file:') ? selected.file : 'file://' + selected.file.replace(/\\/g, '/')) : '';
  const PreviewIcon = selected?.type === 'audio' ? Music2 : selected?.type === 'image' ? Image : Film;

  return <section className="timeline-editor-view">
    <div className="timeline-editor-heading"><div><p className="eyebrow">NON-LINEAR EDITING</p><h1>Video Studio</h1><p className="subhead">Arrange video, image, audio, and title clips across independent tracks. Save editable projects and render an MP4 locally with FFmpeg.</p></div><div className="timeline-heading-actions"><button className="secondary-button" onClick={onTools}><Layers3 size={14}/> Media tools</button><button className="secondary-button" onClick={loadProject} disabled={!!busy}><FolderOpen size={14}/> Open project</button><button className="primary-button" onClick={saveProject} disabled={!!busy}><Save size={14}/> Save project</button></div></div>
    <div className="timeline-ai-edit-panel timeline-edit-assistant">
      <div className="assistant-kicker"><Sparkles size={15}/> CO-AGENT CREATIVE DIRECTOR <span>· ADVANCED</span></div><h2>Tell me how you want the video to feel.</h2>
      <p>Talk naturally: ask for cuts, titles, timing, captions, or soundtrack placement. I’ll propose exact timeline changes first; nothing is changed until you approve the plan.</p>
      <textarea className="edit-prompt" aria-label="Describe video edits" value={editPrompt} onChange={event => setEditPrompt(event.target.value)} rows={3} maxLength={2000} placeholder="Make the opening punchier, add a title that says “A new beginning”, then move the second clip to 5 seconds…"/><div className="assistant-suggestions"><button type="button" onClick={() => setEditPrompt('Add a bold opening title and keep it on screen for 3 seconds.')}>Add an opening title</button><button type="button" onClick={() => setEditPrompt('Trim the selected clip to 8 seconds and move it to start at 1 second.')}>Tighten the pacing</button><button type="button" onClick={() => setEditPrompt('Create a clean sequence from the current clips and align them without overlaps.')}>Clean up the sequence</button></div><div className="assistant-actions"><span className="tool-hint">Your request is reviewed before edits are applied.</span><button className="primary-button" onClick={planTimelineEdit} disabled={planningEdit || !!busy || !editPrompt.trim()}>{planningEdit ? 'Planning edits…' : 'Plan timeline edits'}</button></div><div className="review-banner"><Sparkles size={15}/><span>Safe edit flow: preview the proposed changes, discard anything you don’t want, or explicitly approve the plan. No commands or exports run from this chat.</span></div>
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
    <div className="timeline-panel tool-integration-panel">
      <div className="panel-heading"><strong><Sparkles size={16}/> Generate assets for this edit</strong><span>Local voice + sound effects</span></div>
      <p className="studio-footnote">Voiceover uses LuxTTS voice cloning and a reference recording you choose. Sound effects are generated locally with FFmpeg and placed directly on Audio 1. Generated assets remain editable timeline clips.</p>
      <label>Voiceover script<textarea value={voiceText} onChange={e => setVoiceText(e.target.value)} rows={3} maxLength={12000} placeholder="Write narration for this video…"/></label>
      <div className="export-row"><button className="secondary-button" onClick={chooseVoiceReference}><FolderOpen size={14}/>{voiceReference ? baseName(voiceReference) : 'Choose reference voice'}</button><button className="primary-button" disabled={!!busy || !voiceStatus.installed || !voiceStatus.ffprobeReady || !voiceText.trim() || !voiceReference} onClick={generateVoiceover}><Music2 size={14}/>{busy === 'voice' ? 'Generating voice…' : 'Generate voiceover & add to timeline'}</button><button className="text-link" onClick={refreshVoiceStatus}>Refresh LuxTTS</button></div>
      {!voiceStatus.installed && <p className="tool-hint">{voiceStatus.message || 'LuxTTS is not installed. Set it up from first-run setup or Integrations.'}</p>}
      {generationProgress && <p className="tool-hint" role="status">{generationProgress}</p>}
      <div className="export-row"><label>Sound effect<select value={soundPreset} onChange={e => setSoundPreset(e.target.value)}><option value="impact">Impact / hit</option><option value="sweep">Rising sweep</option><option value="ambient">Soft ambient noise</option><option value="beep">UI notification</option></select></label><label>Duration (seconds)<input type="number" min="0.25" max="12" step="0.25" value={soundDuration} onChange={e => setSoundDuration(Math.max(0.25, Math.min(12, Number(e.target.value) || 2)))}/></label><button className="secondary-button" disabled={!!busy} onClick={generateSoundEffect}><Sparkles size={14}/>{busy === 'sound' ? 'Generating…' : 'Generate SFX & add to timeline'}</button></div>
    </div>
    <div className="timeline-export"><div><strong>Export timeline</strong><p>FFmpeg renders video/image overlays and title cards, plus audio clips on the Audio 1 track. This is a functional editor foundation; transitions, keyframes, color grading, and waveform rendering are not included yet.</p></div><div className="timeline-export-controls"><label>Filename<input value={filename} onChange={e => setFilename(e.target.value)} /></label><button className="secondary-button" onClick={async () => { const dir = await desktop.dialog.chooseDirectory(); if (dir) setOutputDir(dir); }}><FolderOpen size={14}/>{outputDir ? baseName(outputDir) : 'Output folder'}</button><button className="primary-button" disabled={!!busy || !project.clips.length} onClick={exportTimeline}><Download size={14}/>{busy === 'render' ? 'Rendering…' : 'Render MP4'}</button>{busy === 'render' && <button className="secondary-button" onClick={cancelTimelineExport}>Cancel export</button>}</div></div>
    {notice && <p className="studio-notice" role="status">{notice}</p>}
    <p className="computer-footnote">Project files store source paths, trim points, track assignment, captions, and timeline positions. Media remains in its original location; keep source files available when reopening a project.</p>
  </section>;
}
