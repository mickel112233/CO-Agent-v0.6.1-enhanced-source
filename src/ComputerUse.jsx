import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, RefreshCw, MousePointer2, Keyboard, Type, ShieldCheck, AlertTriangle, Eye, ScanSearch, CheckCircle2 } from 'lucide-react';

const desktop = window.coAgent;

export default function ComputerUse() {
  const [screens, setScreens] = useState([]);
  const [screenIndex, setScreenIndex] = useState(0);
  const [windows, setWindows] = useState([]);
  const [x, setX] = useState('640');
  const [y, setY] = useState('360');
  const [text, setText] = useState('');
  const [key, setKey] = useState('ENTER');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [screenText, setScreenText] = useState('');

  const capture = useCallback(async () => {
    setBusy('capture'); setNotice('');
    try {
      const result = await desktop?.computerUse?.captureScreen();
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Screen capture failed.');
      setScreens(result || []); setScreenIndex(0);
      if (!result?.length) setNotice('No screen was returned by Electron.');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }, []);

  useEffect(() => { capture(); }, [capture]);

  async function readText() {
    if (!current) return;
    if (!window.confirm('Read visible text from ' + current.name + ' using local Tesseract OCR? The screenshot stays on this device.')) return;
    setBusy('ocr'); setNotice('');
    try {
      const result = await desktop?.computerUse?.readScreenText({ sourceId: current.id, language: 'eng', approved: true });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Screen OCR failed.');
      setScreenText(result.text || '(No text was detected.)');
      setNotice('Screen text extracted locally. Review it before using it in a task.');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  async function inspect() {
    setBusy('inspect'); setNotice('');
    try {
      const result = await desktop?.computerUse?.inspectAccessibility();
      if (result?.ok === false || result?.error) throw new Error(result.error || 'UI Automation failed.');
      setWindows(result.windows || []);
      setNotice('Accessibility inspection found ' + (result.windows || []).length + ' top-level window(s).');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  async function perform(action, payload, description) {
    if (!window.confirm('Approve computer action?\n\n' + description + '\n\nCO-Agent will perform only this one action. Review the screen first and avoid entering passwords or secrets.')) return;
    setBusy(action); setNotice('');
    try {
      const method = action === 'click' ? desktop.computerUse.click : action === 'type' ? desktop.computerUse.typeText : desktop.computerUse.pressKey;
      const result = await method({ ...payload, approved: true });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Action failed.');
      setLastAction(description);
      setNotice('Action sent. Capture the screen again to verify the result.');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  const current = screens[screenIndex];
  return <section className="computer-use-view">
    <div className="computer-use-heading">
      <div><p className="eyebrow">LOCAL DESKTOP CONTROL</p><h1>Computer Use</h1><p className="subhead">Inspect your real Windows desktop, review visible windows, and run one explicitly approved mouse or keyboard action at a time.</p></div>
      <button className="secondary-button" onClick={capture} disabled={!!busy}><RefreshCw size={14} className={busy === 'capture' ? 'spin' : ''}/> Capture screen</button>
    </div>
    <div className="computer-safety"><ShieldCheck size={20}/><div><strong>Approval required for every action</strong><p>No autonomous action loop or arbitrary shell execution is enabled. Review the screen, approve a specific action, then capture again to verify it.</p></div></div>
    <div className="computer-use-grid">
      <div className="computer-screen-card">
        <div className="panel-heading"><strong><Monitor size={16}/> Desktop capture</strong><div className="computer-panel-actions"><span>{current ? current.width + ' × ' + current.height : 'No capture'}</span><button className="secondary-button" onClick={readText} disabled={!current || !!busy}><ScanSearch size={13}/>{busy === 'ocr' ? 'Reading…' : 'Read screen text'}</button></div></div>
        {current ? <img className="computer-screen-image" src={current.dataUrl} alt={current.name || 'Desktop screenshot'}/> : <div className="computer-screen-empty"><Monitor size={32}/><span>Capture the screen to start.</span></div>}
        {screenText && <div className="computer-screen-ocr"><strong>Local OCR result</strong><textarea aria-label="Screen OCR result" readOnly value={screenText}/><button className="secondary-button" onClick={() => navigator.clipboard?.writeText(screenText).then(() => setNotice('Screen text copied.')).catch(() => setNotice('Clipboard access unavailable.'))}>Copy text</button></div>}{screens.length > 1 && <div className="computer-screen-switch">{screens.map((screen, i) => <button key={screen.id} className={screenIndex === i ? 'selected' : ''} onClick={() => setScreenIndex(i)}>{screen.name}</button>)}</div>}
        <div className="computer-action-grid">
          <div className="computer-action-card"><div className="computer-action-title"><MousePointer2 size={15}/> Click screen coordinates</div><div className="computer-fields"><label>X<input inputMode="numeric" value={x} onChange={e => setX(e.target.value)}/></label><label>Y<input inputMode="numeric" value={y} onChange={e => setY(e.target.value)}/></label></div><button className="primary-button" disabled={!!busy || !current} onClick={() => perform('click', { x: Math.round(Number(x) * (current.bounds?.width || current.width) / current.width), y: Math.round(Number(y) * (current.bounds?.height || current.height) / current.height), displayId: current.displayId }, 'Click at screenshot coordinate X=' + x + ', Y=' + y + ' on ' + current.name)}><MousePointer2 size={14}/> Approve & click</button><small>Coordinates refer to the screenshot image, then scale to the selected display.</small></div>
          <div className="computer-action-card"><div className="computer-action-title"><Type size={15}/> Type text</div><textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Enter non-sensitive text to type into the focused app…"/><button className="secondary-button" disabled={!!busy || !text.trim()} onClick={() => perform('type', { text }, 'Type ' + text.length + ' character(s) into the currently focused app')}><Keyboard size={14}/> Approve & type</button><small>Focus the intended app first. Do not type passwords, API keys, or private information.</small></div>
          <div className="computer-action-card"><div className="computer-action-title"><Keyboard size={15}/> Press a key</div><select value={key} onChange={e => setKey(e.target.value)}>{['ENTER','TAB','ESC','SPACE','BACKSPACE','DELETE','UP','DOWN','LEFT','RIGHT','HOME','END','PAGEUP','PAGEDOWN','CTRL','ALT','SHIFT','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].map(k => <option key={k} value={k}>{k}</option>)}</select><button className="secondary-button" disabled={!!busy} onClick={() => perform('key', { key }, 'Press the ' + key + ' key')}><Keyboard size={14}/> Approve & press</button><small>Only one key is sent per approval. Modifier combinations are not automated.</small></div>
        </div>
      </div>
      <div className="computer-inspect-card">
        <div className="panel-heading"><strong><ScanSearch size={16}/> Windows accessibility</strong><button className="tool-button" title="Inspect windows" onClick={inspect} disabled={!!busy}><RefreshCw size={14}/></button></div>
        <p className="computer-help">Read top-level window names and basic UI Automation properties from Windows. This helps identify the app you intend to control; it does not inspect private content in the background.</p>
        <button className="secondary-button" onClick={inspect} disabled={!!busy}><Eye size={14}/>{busy === 'inspect' ? 'Inspecting…' : 'Inspect accessible windows'}</button>
        {windows.length > 0 ? <div className="computer-window-list">{windows.map((item, i) => <div key={i}><strong>{item.name || '(unnamed window)'}</strong><small>{item.type || 'Control'}{item.className ? ' · ' + item.className : ''}{item.automationId ? ' · ID ' + item.automationId : ''}</small></div>)}</div> : <div className="computer-empty-list"><AlertTriangle size={16}/><span>No window list yet. On Windows, run an accessibility inspection.</span></div>}
      </div>
    </div>
    {lastAction && <p className="computer-last-action"><CheckCircle2 size={15}/> Last approved action: {lastAction}</p>}
    {notice && <p className="studio-notice" role="status">{notice}</p>}
    <p className="computer-footnote">Safety limits: mouse clicks are coordinate-bounded; text is limited to 2,000 characters; keys are allow-listed; each action requires a confirmation dialog. Native input currently requires Windows and a real interactive desktop session.</p>
  </section>;
}
