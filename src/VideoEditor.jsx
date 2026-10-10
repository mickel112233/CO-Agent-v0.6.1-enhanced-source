import React, { useEffect, useMemo, useState } from 'react';
import TimelineEditor from './TimelineEditor.jsx';
import { Film, FolderOpen, Scissors, AudioLines, Download, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle2, ScanText, Clapperboard, Play, FileCheck2 } from 'lucide-react';

const desktop = window.coAgent;
const imageFilters = [{ name: 'Images for OCR', extensions: ['png','jpg','jpeg','tif','tiff','bmp','webp'] }];

export default function VideoEditor() {
  const [mode, setMode] = useState('timeline');
  const [files, setFiles] = useState([]);
  const [outputDir, setOutputDir] = useState('');
  const [name, setName] = useState('co-agent-export.mp4');
  const [selected, setSelected] = useState(0);
  const [probe, setProbe] = useState(null);
  const [caps, setCaps] = useState({ ffmpeg: false, ffprobe: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [ocrStatus, setOcrStatus] = useState({ available: false, error: 'Checking Tesseract…' });
  const [ocrText, setOcrText] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [hyperStatus, setHyperStatus] = useState({ available: false, error: 'Checking Hyperframes…' });
  const [hyperProject, setHyperProject] = useState('');
  const [hyperBusy, setHyperBusy] = useState(false);
  const current = files[selected];
  const duration = useMemo(() => {
    const d = Number(probe?.format?.duration);
    return Number.isFinite(d) ? d : null;
  }, [probe]);

  async function refreshOptionalTools() {
    try {
      const [media, ocr, hyper] = await Promise.all([
        desktop?.studio?.capabilities?.(), desktop?.studio?.ocrStatus?.(), desktop?.studio?.hyperframesStatus?.()
      ]);
      if (media && !media.error) setCaps(media);
      if (ocr) setOcrStatus(ocr);
      if (hyper) setHyperStatus(hyper);
    } catch (e) { setNotice(e.message || String(e)); }
  }
  useEffect(() => { refreshOptionalTools(); }, []);

  async function importFiles() {
    setNotice('');
    try {
      const result = await desktop.dialog.openFiles({ multiple: true, filters: [{ name: 'Video and audio', extensions: ['mp4','mov','mkv','webm','avi','mp3','wav','m4a','aac'] }] });
      if (Array.isArray(result) && result.length) {
        setFiles(old => {
          const next = [...old, ...result.filter(p => !old.includes(p))];
          setSelected(Math.max(0, next.length - 1));
          return next;
        });
        setProbe(null);
      }
    } catch (e) { setNotice(e.message || String(e)); }
  }
  async function inspect(file = current) {
    if (!file) return;
    setBusy(true); setNotice('');
    try {
      const result = await desktop.studio.probe(file);
      if (result?.ok === false || result?.error) throw new Error(result.error);
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
      if (result?.ok === false || result?.error) throw new Error(result.error);
      setNotice('Export complete: ' + result.output);
    } catch (e) { setNotice(e.message || String(e)); }
    finally { setBusy(false); }
  }
  async function extractAudio() {
    if (!current) return;
    setBusy(true); setNotice('');
    try {
      const result = await desktop.studio.extractAudio({ input: current, outputDir: outputDir || undefined });
      if (result?.ok === false || result?.error) throw new Error(result.error);
      setNotice('Audio extracted: ' + result.output);
    } catch (e) { setNotice(e.message || String(e)); }
    finally { setBusy(false); }
  }
  async function runOCR() {
    setNotice('');
    try {
      const picked = await desktop.dialog.openFiles({ multiple: false, filters: imageFilters });
      const file = Array.isArray(picked) ? picked[0] : null;
      if (!file) return;
      setOcrBusy(true); setOcrText('');
      const result = await desktop.studio.ocrImage({ input: file, language: 'eng' });
      if (result?.ok === false || result?.error) throw new Error(result.error);
      setOcrText(result.text || '(No text was detected in this image.)');
    } catch (e) { setNotice(e.message || String(e)); }
    finally { setOcrBusy(false); }
  }
  async function chooseHyperProject() {
    try {
      const dir = await desktop.dialog.chooseDirectory();
      if (dir) setHyperProject(dir);
    } catch (e) { setNotice(e.message || String(e)); }
  }
  async function runHyperframes(action) {
    if (!hyperProject) { setNotice('Choose a Hyperframes project folder containing index.html first.'); return; }
    setHyperBusy(true); setNotice('');
    try {
      const result = await desktop.studio.hyperframesRun({ action, projectDir: hyperProject });
      if (result?.ok === false || result?.error) throw new Error(result.error);
      setNotice(result.message || (action === 'render' ? 'Rendered: ' + result.output : 'Hyperframes ' + action + ' started.'));
    } catch (e) { setNotice(e.message || String(e)); }
    finally { setHyperBusy(false); }
  }

  if (mode === 'timeline') return <TimelineEditor onBasic={() => setMode('basic')}/>;

  return <section className="studio-view">
    <div className="studio-heading"><div><p className="eyebrow">CREATION WORKSPACE</p><h1>Video Studio</h1><p className="subhead">Import media, inspect clips, extract audio, assemble sequences, and use optional OCR and HTML-to-video tools.</p></div><div className="studio-heading-actions"><button className="secondary-button" onClick={() => setMode('timeline')}><Film size={14}/> Advanced timeline</button><button className="primary-button" onClick={importFiles}><Plus size={16}/> Import media</button></div></div>
    <div className="studio-status">
      <span className={caps.ffmpeg ? 'cap-ok' : 'cap-missing'}>{caps.ffmpeg ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} FFmpeg {caps.ffmpeg ? 'ready' : 'missing'}</span>
      <span className={caps.ffprobe ? 'cap-ok' : 'cap-missing'}>{caps.ffprobe ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} FFprobe {caps.ffprobe ? 'ready' : 'missing'}</span>
      <span className={ocrStatus.available ? 'cap-ok' : 'cap-missing'}>{ocrStatus.available ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} Tesseract OCR {ocrStatus.available ? 'ready' : 'optional / not found'}</span>
      <span className={hyperStatus.available ? 'cap-ok' : 'cap-missing'}>{hyperStatus.available ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} Hyperframes {hyperStatus.available ? 'ready' : 'optional / not found'}</span>
      <button className="tool-button" onClick={refreshOptionalTools} title="Refresh tool status"><RefreshCw size={14}/></button>
    </div>
    <div className="studio-layout">
      <div className="media-panel">
        <div className="panel-heading"><strong><Film size={16}/> Media bin</strong><span>{files.length} files</span></div>
        {files.length ? <div className="media-list">{files.map((file, i) => <div key={file} className={'media-row ' + (selected === i ? 'selected' : '')} onClick={() => { setSelected(i); setProbe(null); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setSelected(i); setProbe(null); } }}><Film size={16}/><span title={file}>{file.split(/[\\/]/).pop()}</span><button className="remove-media" aria-label="Remove media" onClick={e => { e.stopPropagation(); setFiles(old => old.filter((_, j) => j !== i)); setSelected(0); setProbe(null); }}><Trash2 size={14}/></button></div>)}</div> : <div className="empty-media"><FolderOpen size={25}/><strong>No media yet</strong><span>Import video or audio files to start.</span><button className="secondary-button" onClick={importFiles}>Browse files</button></div>}
      </div>
      <div className="preview-panel">
        <div className="panel-heading"><strong>Preview & details</strong>{current && <button className="tool-button" onClick={() => inspect()} title="Inspect clip"><RefreshCw size={15}/></button>}</div>
        {current ? <><div className="preview-frame">{/\.(mp4|mov|webm|m4v|ogv)$/i.test(current) ? <video key={current} src={current.startsWith('file:') ? current : 'file://' + current.replace(/\\/g,'/')} controls /> : <div className="audio-preview"><AudioLines size={34}/><span>{current.split(/[\\/]/).pop()}</span></div>}</div><div className="clip-details"><div><small>FILE</small><span>{current.split(/[\\/]/).pop()}</span></div><div><small>DURATION</small><span>{duration === null ? 'Not inspected' : Math.round(duration) + ' sec'}</span></div><div><small>FORMAT</small><span>{probe?.format?.format_name || '—'}</span></div></div><button className="secondary-button" disabled={busy || !caps.ffprobe} onClick={() => inspect()}><RefreshCw size={14}/> {busy ? 'Inspecting…' : 'Inspect metadata'}</button></> : <div className="empty-preview"><Film size={28}/><span>Select a clip to see its preview and details.</span></div>}
      </div>
    </div>
    <div className="timeline-panel"><div className="panel-heading"><strong><Scissors size={16}/> Assembly timeline</strong><span>Simple sequence · files are joined in listed order</span></div>{files.length ? <div className="timeline-track">{files.map((file, i) => <button key={file} onClick={() => setSelected(i)} className={'timeline-clip ' + (selected === i ? 'selected' : '')}><span>{String(i + 1).padStart(2, '0')}</span>{file.split(/[\\/]/).pop()}</button>)}</div> : <div className="timeline-empty">Import clips to populate the sequence.</div>}<div className="export-row"><input aria-label="Export filename" value={name} onChange={e => setName(e.target.value)} /><button className="secondary-button" onClick={chooseOutput}><FolderOpen size={14}/>{outputDir ? outputDir.split(/[\\/]/).pop() : 'Output folder'}</button><button className="secondary-button" disabled={!current || busy || !caps.ffmpeg} onClick={extractAudio}><AudioLines size={14}/> Extract audio</button><button className="primary-button" disabled={!files.length || busy || !caps.ffmpeg} onClick={exportJoin}><Download size={15}/>{busy ? 'Working…' : 'Export sequence'}</button></div></div>
    <div className="timeline-panel tool-integration-panel">
      <div className="panel-heading"><strong><ScanText size={16}/> Image text extraction</strong><span>Local Tesseract OCR</span></div>
      <p className="studio-footnote">Extract readable text from screenshots, scanned pages, and still images. Tesseract must be installed separately; OCR runs locally on this device.</p>
      <div className="export-row"><button className="secondary-button" disabled={ocrBusy || !ocrStatus.available} onClick={runOCR}><ScanText size={14}/>{ocrBusy ? 'Reading image…' : 'Choose image & extract text'}</button><span className="tool-hint">{ocrStatus.available ? ocrStatus.version : ocrStatus.error}</span></div>
      {ocrText && <><textarea className="ocr-result" aria-label="Extracted OCR text" readOnly value={ocrText}/><button className="secondary-button" onClick={() => navigator.clipboard?.writeText(ocrText).then(() => setNotice('OCR text copied.')).catch(() => setNotice('Clipboard access was unavailable.'))}>Copy extracted text</button></>}
    </div>
    <div className="timeline-panel tool-integration-panel">
      <div className="panel-heading"><strong><Clapperboard size={16}/> Hyperframes video renderer</strong><span>HTML / CSS / animation → MP4</span></div>
      <p className="studio-footnote">Open an existing Hyperframes project containing <code>index.html</code>, validate it, preview it, or render a deterministic video. The Hyperframes CLI and FFmpeg are optional external tools.</p>
      <div className="export-row"><button className="secondary-button" onClick={chooseHyperProject}><FolderOpen size={14}/>{hyperProject ? hyperProject.split(/[\\/]/).filter(Boolean).pop() : 'Choose project folder'}</button><button className="secondary-button" disabled={!hyperStatus.available || hyperBusy || !hyperProject} onClick={() => runHyperframes('lint')}><FileCheck2 size={14}/> Lint project</button><button className="secondary-button" disabled={!hyperStatus.available || hyperBusy || !hyperProject} onClick={() => runHyperframes('preview')}><Play size={14}/> Preview</button><button className="primary-button" disabled={!hyperStatus.available || hyperBusy || !hyperProject} onClick={() => runHyperframes('render')}><Clapperboard size={14}/>{hyperBusy ? 'Running…' : 'Render MP4'}</button></div>
      {!hyperStatus.available && <p className="tool-hint">{hyperStatus.error} See docs/AI-ONBOARDING.md for setup notes.</p>}
    </div>
    {notice && <p className="studio-notice" role="status">{notice}</p>}
    <p className="studio-footnote">The built-in sequence join uses FFmpeg stream copy, so source clips should have compatible codecs, dimensions, and frame rates. Hyperframes renders a separate HTML-based project; it does not replace the simple sequence join.</p>
  </section>;
}
