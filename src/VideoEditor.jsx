import React, { useEffect, useMemo, useState } from 'react';
import { Film, FolderOpen, Scissors, AudioLines, Download, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

const desktop = window.coAgent;
export default function VideoEditor() {
  const [files, setFiles] = useState([]);
  const [outputDir, setOutputDir] = useState('');
  const [name, setName] = useState('co-agent-export.mp4');
  const [selected, setSelected] = useState(0);
  const [probe, setProbe] = useState(null);
  const [caps, setCaps] = useState({ ffmpeg: false, ffprobe: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const current = files[selected];
  const duration = useMemo(() => {
    const d = Number(probe?.format?.duration);
    return Number.isFinite(d) ? d : null;
  }, [probe]);

  useEffect(() => {
    desktop?.studio?.capabilities?.().then(r => { if (r && !r.error) setCaps(r); }).catch(() => {});
  }, []);

  async function importFiles() {
    setNotice('');
    try {
      const result = await desktop.dialog.openFiles({ multiple: true, filters: [{ name: 'Video and audio', extensions: ['mp4','mov','mkv','webm','avi','mp3','wav','m4a','aac'] }] });
      if (Array.isArray(result) && result.length) {
        setFiles(old => [...old, ...result.filter(p => !old.includes(p))]);
        setSelected(files.length);
        setProbe(null);
      }
    } catch (e) { setNotice(e.message || String(e)); }
  }
  async function inspect(file = current) {
    if (!file) return;
    setBusy(true); setNotice('');
    try {
      const result = await desktop.studio.probe(file);
      if (result?.ok === false) throw new Error(result.error);
      setProbe(result);
    } catch (e) { setNotice(e.message || String(e)); }
    finally { setBusy(false); }
  }
  async function chooseOutput() {
    try {
      const dir = await desktop.dialog.chooseDirectory();
      if (dir) setOutputDir(dir);
    } catch (e) { setNotice(e.message || String(e)); }
  }
  async function exportJoin() {
    if (!files.length) return;
    setBusy(true); setNotice('');
    try {
      let dir = outputDir;
      if (!dir) { dir = await desktop.dialog.chooseDirectory(); if (!dir) return; setOutputDir(dir); }
      const result = await desktop.studio.concat({ inputs: files, outputDir: dir, filename: name });
      if (result?.ok === false) throw new Error(result.error);
      setNotice('Export complete: ' + result.output);
    } catch (e) { setNotice(e.message || String(e)); }
    finally { setBusy(false); }
  }
  async function extractAudio() {
    if (!current) return;
    setBusy(true); setNotice('');
    try {
      const result = await desktop.studio.extractAudio({ input: current, outputDir: outputDir || undefined });
      if (result?.ok === false) throw new Error(result.error);
      setNotice('Audio extracted: ' + result.output);
    } catch (e) { setNotice(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return <section className="studio-view">
    <div className="studio-heading"><div><p className="eyebrow">CREATION WORKSPACE</p><h1>Video Studio</h1><p className="subhead">Import media, inspect clips, extract audio, and join compatible files into an export.</p></div><button className="primary-button" onClick={importFiles}><Plus size={16}/> Import media</button></div>
    <div className="studio-status">
      <span className={caps.ffmpeg ? 'cap-ok' : 'cap-missing'}>{caps.ffmpeg ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} FFmpeg {caps.ffmpeg ? 'ready' : 'missing'}</span>
      <span className={caps.ffprobe ? 'cap-ok' : 'cap-missing'}>{caps.ffprobe ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} FFprobe {caps.ffprobe ? 'ready' : 'missing'}</span>
    </div>
    <div className="studio-layout">
      <div className="media-panel">
        <div className="panel-heading"><strong><Film size={16}/> Media bin</strong><span>{files.length} files</span></div>
        {files.length ? <div className="media-list">{files.map((file, i) => <button key={file} className={'media-row ' + (selected === i ? 'selected' : '')} onClick={() => { setSelected(i); setProbe(null); }}><Film size={16}/><span title={file}>{file.split(/[\\/]/).pop()}</span><button className="remove-media" aria-label="Remove media" onClick={e => { e.stopPropagation(); setFiles(old => old.filter((_, j) => j !== i)); setSelected(0); setProbe(null); }}><Trash2 size={14}/></button></button>)}</div> : <div className="empty-media"><FolderOpen size={25}/><strong>No media yet</strong><span>Import video or audio files to start.</span><button className="secondary-button" onClick={importFiles}>Browse files</button></div>}
      </div>
      <div className="preview-panel">
        <div className="panel-heading"><strong>Preview & details</strong>{current && <button className="tool-button" onClick={() => inspect()} title="Inspect clip"><RefreshCw size={15}/></button>}</div>
        {current ? <><div className="preview-frame">{/\.(mp4|mov|webm|m4v|ogv)$/i.test(current) ? <video key={current} src={current.startsWith('file:') ? current : 'file://' + current.replace(/\\/g,'/')} controls /> : <div className="audio-preview"><AudioLines size={34}/><span>{current.split(/[\\/]/).pop()}</span></div>}</div><div className="clip-details"><div><small>FILE</small><span>{current.split(/[\\/]/).pop()}</span></div><div><small>DURATION</small><span>{duration === null ? 'Not inspected' : Math.round(duration) + ' sec'}</span></div><div><small>FORMAT</small><span>{probe?.format?.format_name || '—'}</span></div></div><button className="secondary-button" disabled={busy || !caps.ffprobe} onClick={() => inspect()}><RefreshCw size={14}/> {busy ? 'Inspecting…' : 'Inspect metadata'}</button></> : <div className="empty-preview"><Film size={28}/><span>Select a clip to see its preview and details.</span></div>}
      </div>
    </div>
    <div className="timeline-panel"><div className="panel-heading"><strong><Scissors size={16}/> Assembly timeline</strong><span>Simple sequence · files are joined in listed order</span></div>{files.length ? <div className="timeline-track">{files.map((file, i) => <button key={file} onClick={() => setSelected(i)} className={'timeline-clip ' + (selected === i ? 'selected' : '')}><span>{String(i + 1).padStart(2, '0')}</span>{file.split(/[\\/]/).pop()}</button>)}</div> : <div className="timeline-empty">Import clips to populate the sequence.</div>}<div className="export-row"><input aria-label="Export filename" value={name} onChange={e => setName(e.target.value)} /><button className="secondary-button" onClick={chooseOutput}><FolderOpen size={14}/>{outputDir ? outputDir.split(/[\\/]/).pop() : 'Output folder'}</button><button className="secondary-button" disabled={!current || busy || !caps.ffmpeg} onClick={extractAudio}><AudioLines size={14}/> Extract audio</button><button className="primary-button" disabled={!files.length || busy || !caps.ffmpeg} onClick={exportJoin}><Download size={15}/>{busy ? 'Working…' : 'Export sequence'}</button></div></div>
    {notice && <p className="studio-notice" role="status">{notice}</p>}
    <p className="studio-footnote">Exports use FFmpeg installed with CO-Agent. The sequence join uses stream copy, so source clips should have compatible codecs, dimensions, and frame rates.</p>
  </section>;
}
