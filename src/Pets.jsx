import React, { useCallback, useEffect, useState } from 'react';
import { Activity, PawPrint, RefreshCw, Eye, EyeOff, ExternalLink, ShieldCheck, Monitor } from 'lucide-react';
import petIdle from '../integrations/AI-Desktop-Pet/public/assets/albedo/id1_1.png';

const desktop = window.coAgent;
const explainError = error => error?.message || String(error || 'Unknown error');

export default function Pets() {
  const [petStatus, setPetStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(null);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!desktop?.pet?.status) {
      setPetStatus(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const result = await desktop.pet.status();
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Could not read pet status.');
      setPetStatus(result);
    } catch (error) {
      setNotice(explainError(error));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function runPetAction(action, successMessage) {
    if (!desktop?.pet?.[action]) {
      setNotice('Pet controls are available in the CO-Agent desktop app.');
      return;
    }
    setBusy(action);
    setNotice('');
    try {
      const result = await desktop.pet[action]();
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Pet action failed.');
      if (typeof result?.visible === 'boolean') setOverlayVisible(result.visible);
      if (action === 'launch' || action === 'close') setPetStatus(await desktop.pet.status());
      setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage);
    } catch (error) {
      setNotice(explainError(error));
    } finally {
      setBusy('');
    }
  }

  const nativeState = checking ? 'Checking' : !petStatus ? 'Desktop app required' : !petStatus.supported ? 'Windows only' : petStatus.running ? 'Running' : petStatus.installed ? 'Ready to launch' : 'Source included';
  const canUseOverlay = Boolean(desktop?.pet?.showOverlay && desktop?.pet?.hideOverlay);

  return <section className="pets-view">
    <header className="pets-heading">
      <div>
        <p className="eyebrow">COMPANION</p>
        <h1>Pets</h1>
        <p className="subhead">A small desktop companion, with controls that stay in your hands.</p>
      </div>
      <button type="button" className="tool-button pets-refresh" onClick={refresh} disabled={checking || !!busy} title="Refresh pet status" aria-label="Refresh pet status"><RefreshCw size={16}/></button>
    </header>

    <div className="pets-workspace">
      <article className="pet-preview-card">
        <div className="pet-preview-stage">
          <img src={petIdle} alt="Idle sprite from the included AI-Desktop-Pet project"/>
        </div>
        <div className="pet-preview-caption"><span className="pet-state-dot"/><span>Included companion art</span><code>AI-Desktop-Pet</code></div>
      </article>

      <div className="pets-control-stack">
        <article className="pet-control-card">
          <div className="pet-card-heading"><div><span className="pet-icon"><PawPrint size={17}/></span><div><h2>CO-Agent overlay</h2><p>Show the companion on your desktop. Its in-app chat bridge still uses CO-Agent's existing approval rules.</p></div></div><span className={'pet-state-pill ' + (overlayVisible === true ? 'ready' : '')}>{overlayVisible === null ? 'Available' : overlayVisible ? 'Visible' : 'Hidden'}</span></div>
          <div className="pet-action-row">
            <button type="button" className="primary-button" onClick={() => runPetAction('showOverlay', 'The companion overlay is visible.')} disabled={!canUseOverlay || !!busy}><Eye size={15}/>{busy === 'showOverlay' ? 'Showing…' : 'Show companion'}</button>
            <button type="button" className="secondary-button" onClick={() => runPetAction('hideOverlay', 'The companion overlay is hidden.')} disabled={!canUseOverlay || !!busy}><EyeOff size={15}/>{busy === 'hideOverlay' ? 'Hiding…' : 'Hide companion'}</button>
          </div>
        </article>

        <article className="pet-control-card">
          <div className="pet-card-heading"><div><span className="pet-icon"><Monitor size={17}/></span><div><h2>Native AI-Desktop-Pet app</h2><p>The complete upstream source and sprite assets are included in this repository.</p></div></div><span className={'pet-state-pill ' + (petStatus?.running ? 'ready' : '')}>{nativeState}</span></div>
          <div className="pet-native-detail"><Activity size={14}/><span>{petStatus?.message || (checking ? 'Checking the native companion…' : 'Open this page in the CO-Agent desktop app to check the native pet.')}</span></div>
          <div className="pet-action-row">
            <button type="button" className="primary-button" onClick={() => runPetAction('launch', result => result.alreadyRunning ? 'The native companion is already running.' : 'The native companion launched.')} disabled={!petStatus?.supported || !petStatus?.installed || !!busy}><ExternalLink size={15}/>{busy === 'launch' ? 'Launching…' : 'Launch native pet'}</button>
            <button type="button" className="secondary-button" onClick={() => runPetAction('close', result => result.stopped ? 'The native companion closed.' : 'No tracked native-pet process is running.')} disabled={!petStatus?.running || !!busy}>{busy === 'close' ? 'Closing…' : 'Close native pet'}</button>
          </div>
          {!petStatus?.installed && !checking && <p className="pet-build-note"><ShieldCheck size={14}/> Source is included; the native Windows executable is not present in this build. On Windows, build it with <code>npm run build:pet:win</code>.</p>}
        </article>
      </div>
    </div>

    <p className="pets-source-note">The standalone native pet launches only after the existing native confirmation and receives no CO-Agent chat history or API keys. The in-app overlay can be shown independently.</p>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
  </section>;
}
