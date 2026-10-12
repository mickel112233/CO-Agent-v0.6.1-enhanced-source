import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, RefreshCw, MousePointer2, Keyboard, Type, ShieldCheck, AlertTriangle, Eye, ScanSearch, CheckCircle2, Sparkles, Play } from 'lucide-react';

const desktop = window.coAgent;

export default function ComputerUse() {
  const [screens, setScreens] = useState([]);
  const [screenIndex, setScreenIndex] = useState(0);
  const [windows, setWindows] = useState([]);
  const [accessibilityControls, setAccessibilityControls] = useState([]);
  const [x, setX] = useState('640');
  const [y, setY] = useState('360');
  const [text, setText] = useState('');
  const [key, setKey] = useState('ENTER');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [screenText, setScreenText] = useState('');
  const [task, setTask] = useState('');
  const [plan, setPlan] = useState([]);
  const [verification, setVerification] = useState(null);

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
    setBusy('ocr'); setNotice('');
    try {
      const result = await desktop?.computerUse?.readScreenText({ sourceId: current.id, language: 'eng', approved: true });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Screen OCR failed.');
      setScreenText(result.text || '(No text was detected.)');
      setNotice('Screen text extracted locally. Review it before using it in a task.');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  async function planTask() {
    if (!current || !task.trim()) return;
    setBusy('plan'); setNotice(''); setPlan([]);
    try {
      const accessibilityText = accessibilityControls.map(item => [item.type, item.name, item.enabled ? 'enabled' : 'disabled', 'bounds ' + [item.x,item.y,item.width,item.height].join(',')].filter(Boolean).join(' | ')).join('\n').slice(0, 8000);
      const result = await desktop?.computerUse?.planActions({ task, screenText: [screenText, accessibilityText ? 'Accessibility-first control evidence:\n' + accessibilityText : ''].filter(Boolean).join('\n\n').slice(0, 12000), imageBase64: String(current.dataUrl || '').split(',')[1] || '', width: current.width, height: current.height });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Could not plan the task.');
      setPlan(result.actions || []);
      setNotice('Local model ' + result.model + ' suggested ' + (result.actions || []).length + ' action(s). Review every step before approving it.');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  async function runPlanned(action) {
    if (!current) return;
    const payload = action.type === 'click' ? { x: Math.round(action.x * (current.bounds?.width || current.width) / current.width), y: Math.round(action.y * (current.bounds?.height || current.height) / current.height), displayId: current.displayId } : action.type === 'type' ? { text: action.text } : { key: action.key };
    const summary = action.type === 'click' ? 'Click at screenshot coordinates ' + action.x + ', ' + action.y : action.type === 'type' ? 'Type suggested text: ' + action.text : 'Press suggested key: ' + action.key;
    const success = await perform(action.type, payload, summary + '. Reason: ' + action.reason);
    // The desktop may have changed after this action, so never keep executing
    // coordinates from a plan grounded in the previous screenshot.
    if (success) setPlan([]);
  }

  async function invokeControl(item) {
    if (!current || !item?.windowName || (!item.name && !item.automationId)) return;
    const before = current;
    const description = 'Invoke ' + (item.name || item.automationId) + ' in ' + item.windowName;
    setBusy('invoke-control'); setNotice('Waiting for native Windows approval…'); setVerification(null);
    try {
      const result = await desktop?.computerUse?.invokeControl({
        windowTitle: item.windowName, name: item.name || '', automationId: item.automationId || '',
        controlType: item.type || ''
      });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Accessibility control invocation failed.');
      const after = await desktop?.computerUse?.captureScreen();
      if (!Array.isArray(after) || !after.length) {
        setNotice('Windows invoked the selected control, but CO-Agent could not recapture the desktop. Inspect it manually.');
        return;
      }
      const afterIndex = Math.max(0, after.findIndex(screen => screen.displayId === before.displayId));
      const observed = after[afterIndex] || after[0];
      setScreens(after); setScreenIndex(afterIndex); setLastAction(description);
      try {
        const checked = await desktop?.computerUse?.verifyOutcome({
          task: description + '. Verify only the visible result of this control invocation.',
          action: 'Windows UI Automation Invoke pattern; exact window and control identity checked',
          beforeImageBase64: String(before.dataUrl || '').split(',')[1] || '',
          afterImageBase64: String(observed.dataUrl || '').split(',')[1] || '',
          beforeText: screenText.slice(0, 3000), afterText: '', model: undefined
        });
        if (checked?.ok === false || checked?.error) throw new Error(checked.error || 'Visual verification failed.');
        setVerification(checked);
        setNotice('Semantic control invoked. Verification: ' + checked.status + ' (' + Math.round(checked.confidence * 100) + '% model confidence). ' + checked.evidence + ' Inspect the updated screenshot before continuing.');
      } catch (error) {
        setNotice('Semantic control invoked and a fresh screenshot was captured, but automated verification was unavailable: ' + (error.message || String(error)) + '. Inspect the screenshot manually.');
      }
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  async function inspect() {
    setBusy('inspect'); setNotice('');
    try {
      const result = await desktop?.computerUse?.inspectAccessibility();
      if (result?.ok === false || result?.error) throw new Error(result.error || 'UI Automation failed.');
      setWindows(result.windows || []);
      setAccessibilityControls(result.controls || []);
      setNotice('Accessibility inspection found ' + (result.windows || []).length + ' window(s) and ' + (result.controls || []).length + ' visible control(s). Planning can now use these labels and bounds as additional evidence.');
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  async function perform(action, payload, description) {
    setBusy(action); setNotice(''); setVerification(null);
    const before = current;
    try {
      const method = action === 'click' ? desktop.computerUse.click : action === 'type' ? desktop.computerUse.typeText : desktop.computerUse.pressKey;
      const result = await method({ ...payload, approved: true });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Action failed.');
      setLastAction(description);
      // Re-observe after every input. A successful SendInput call proves only
      // that input was dispatched; the new capture is evidence for the user
      // to inspect, not a claim that the intended task succeeded.
      await new Promise(resolve => setTimeout(resolve, 650));
      const after = await desktop?.computerUse?.captureScreen();
      if (!Array.isArray(after) || after.length === 0) {
        setNotice('Action was sent, but CO-Agent could not recapture the desktop. Inspect the screen manually before continuing.');
        return true;
      }
      const previousDisplayId = current?.displayId;
      const afterIndex = Math.max(0, after.findIndex(item => item.displayId === previousDisplayId));
      const observed = after[afterIndex] || after[0];
      const changed = !!before && observed.dataUrl !== before.dataUrl;
      setScreens(after);
      setScreenIndex(afterIndex);
      try {
        const beforeBase64 = String(before?.dataUrl || '').split(',')[1] || '';
        const afterBase64 = String(observed.dataUrl || '').split(',')[1] || '';
        const checked = await desktop?.computerUse?.verifyOutcome({
          task: task.trim() || 'Assess the visible result of this approved desktop action.',
          action: description, beforeImageBase64: beforeBase64, afterImageBase64: afterBase64,
          beforeText: screenText.slice(0, 3000), afterText: '', model: undefined
        });
        if (checked?.ok === false || checked?.error) throw new Error(checked.error || 'Verification failed.');
        setVerification(checked);
        const assessment = checked.status === 'verified' ? 'The local model thinks the goal may be achieved' : checked.status === 'not_verified' ? 'The local model did not find evidence that the goal was achieved' : 'The local model could not determine whether the goal was achieved';
        setNotice(assessment + ' (' + Math.round(checked.confidence * 100) + '% confidence). ' + checked.evidence + ' Inspect the screenshot before continuing.');
      } catch (error) {
        setNotice('Fresh screenshot captured (' + (changed ? 'visible pixels changed' : 'no visible change detected') + '), but automated verification was unavailable: ' + (error.message || String(error)) + ' Inspect the screenshot manually.');
      }
      return true;
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(''); }
  }

  const current = screens[screenIndex];
  return <section className="computer-use-view">
    <div className="computer-use-heading">
      <div><p className="eyebrow">LOCAL DESKTOP CONTROL</p><h1>Computer Use</h1><p className="subhead">Inspect your real Windows desktop, review visible windows, and run one explicitly approved mouse or keyboard action at a time.</p></div>
      <button className="secondary-button" onClick={capture} disabled={!!busy}><RefreshCw size={14} className={busy === 'capture' ? 'spin' : ''}/> Capture screen</button>
    </div>
    <div className="computer-safety"><ShieldCheck size={20}/><div><strong>Approval required for every action</strong><p>Local Ollama receives the captured screenshot and optional OCR to propose a short grounded plan. It cannot execute automatically. A native Windows confirmation dialog is shown for every input action. Review each action and capture again to verify the result.</p></div></div>
    <div className="computer-planner"><label>What should CO-Agent do?<textarea value={task} onChange={e => setTask(e.target.value)} maxLength={2000} placeholder="Example: open the settings page and find the display scaling option…"/></label><button className="primary-button" onClick={planTask} disabled={!current || !task.trim() || !!busy}><Sparkles size={14}/>{busy === 'plan' ? 'Planning locally…' : 'Plan with local model'}</button><small>Uses the selected local Ollama model with the actual captured screenshot and optional OCR. Review every coordinate and action. Each input still needs a separate Windows confirmation. Never use it for passwords, purchases, deleting files, or sending/submitting content.</small>{plan.length > 0 && <div className="computer-plan-list"><div className="computer-plan-heading"><strong>Suggested steps · {plan.length}</strong><button className="text-link" onClick={() => setPlan([])}>Discard plan</button></div>{plan.map(action => <article key={action.id} className="computer-plan-step"><div><strong>{action.id}. {action.type === 'click' ? 'Click ' + action.x + ', ' + action.y : action.type === 'type' ? 'Type text' : 'Press ' + action.key}</strong><p>{action.reason}</p>{action.type === 'type' && <code>{action.text}</code>}</div><button className="secondary-button" disabled={!!busy} onClick={() => runPlanned(action)}><Play size={13}/> Approve step</button></article>)}</div>}</div>
    {verification && <div className="computer-safety"><ShieldCheck size={19}/><div><strong>Local outcome assessment: {verification.status.replace('_', ' ')}</strong><p>{verification.evidence}</p><p>Confidence: {Math.round(verification.confidence * 100)}%. {verification.disclaimer}</p><p>Suggested safe next step: {verification.nextStep}</p></div></div>}
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
        {windows.length > 0 ? <div className="computer-window-list">{windows.map((item, i) => <div key={i}><strong>{item.name || '(unnamed window)'}</strong><small>{item.type || 'Window'}{item.className ? ' · ' + item.className : ''}{item.automationId ? ' · ID ' + item.automationId : ''}</small></div>)}</div> : <div className="computer-empty-list"><AlertTriangle size={16}/><span>No window list yet. On Windows, run an accessibility inspection.</span></div>}{accessibilityControls.length > 0 && <div className="computer-window-list computer-control-list"><strong className="computer-control-heading">Visible interactive controls · {accessibilityControls.length}</strong>{accessibilityControls.slice(0, 80).map((item, i) => <div key={i}><strong>{item.name || item.type || 'Unnamed control'}</strong><small>{item.windowName ? item.windowName + ' · ' : ''}{item.type || 'Control'} · {item.enabled ? 'enabled' : 'disabled'} · {item.x},{item.y} · {item.width}×{item.height}{item.automationId ? ' · ID ' + item.automationId : ''}</small><button className="tool-button" disabled={!!busy || !item.enabled || !item.windowName} onClick={() => invokeControl(item)} title="Invoke this exact control through Windows UI Automation">Invoke control</button></div>)}</div>}
      </div>
    </div>
    {lastAction && <p className="computer-last-action"><CheckCircle2 size={15}/> Last approved action: {lastAction}</p>}
    {notice && <p className="studio-notice" role="status">{notice}</p>}
    <p className="computer-footnote">Safety limits: mouse clicks are coordinate-bounded; text is limited to 2,000 characters; keys are allow-listed; each action requires a confirmation dialog. Native input currently requires Windows and a real interactive desktop session.</p>
  </section>;
}
