import React, { useCallback, useEffect, useState } from 'react';
import { Plug, RefreshCw, Download, Github, ShieldCheck, AlertTriangle, CheckCircle2, Circle, Trash2, ExternalLink, Package, ScanText, Clapperboard, Volume2, FolderGit2, Sparkles, LoaderCircle } from 'lucide-react';

const desktop = window.coAgent;
const docs = {
  tesseract: 'https://tesseract-ocr.github.io/tessdoc/Installation.html',
  hyperframes: 'https://hyperframes.app/docs/5-packages/cli',
  piper: 'https://github.com/rhasspy/piper'
};
const formatError = error => error?.message || String(error || 'Unknown error');

export default function Integrations({ selectedSkills = [], onSkillsChange = () => {} }) {
  const [status, setStatus] = useState(null);
  const [repos, setRepos] = useState([]);
  const [url, setUrl] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [skillPreviews, setSkillPreviews] = useState({});

  const refresh = useCallback(async () => {
    setBusy('refresh'); setNotice('');
    try {
      const [toolStatus, installed] = await Promise.all([desktop.integrations.status(), desktop.integrations.listRepos()]);
      if (toolStatus?.error) throw new Error(toolStatus.error);
      setStatus(toolStatus); setRepos(Array.isArray(installed) ? installed : []);
    } catch (error) { setNotice(formatError(error)); }
    finally { setBusy(''); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function installTool(tool) {
    if (!tool.installAvailable) {
      setNotice(tool.id === 'tesseract' ? 'Tesseract does not have a one-click installer for this platform. Use the official setup guide.' : 'Install Node.js/npm first, then use the official Hyperframes setup guide.');
      return;
    }
    const command = tool.id === 'tesseract' ? 'winget install --id UB-Mannheim.TesseractOCR --exact' : 'npm install --global hyperframes';
    if (!window.confirm('Install ' + tool.name + ' on this computer?\n\nCommand: ' + command + '\n\nThis runs the platform package manager and may download software or request administrator approval.')) return;
    setBusy(tool.id); setNotice('Installing ' + tool.name + '. This can take several minutes; do not close CO-Agent.');
    try {
      const result = await desktop.integrations.installTool(tool.id);
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Installation failed.');
      setNotice(tool.name + ' installer finished. Refresh status; a restart may be needed for PATH changes.');
      await refresh();
    } catch (error) { setNotice('Could not install ' + tool.name + ': ' + formatError(error)); }
    finally { setBusy(''); }
  }

  async function installRepository(event) {
    event.preventDefault();
    if (!url.trim()) return;
    if (!window.confirm('Import this GitHub repository into CO-Agent?\n\n' + url.trim() + '\n\nCO-Agent will clone files into its extensions folder and inspect known manifests. It will NOT execute the repository, run install scripts, or install dependencies automatically. Only import repositories you trust.')) return;
    setBusy('repo'); setNotice('Cloning repository and checking its manifest…');
    try {
      const result = await desktop.integrations.installRepo({ url: url.trim(), ref: ref.trim() });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Repository import failed.');
      setRepos(old => [...old.filter(item => item.slug !== result.repository.slug), result.repository]);
      setUrl(''); setRef(''); setShowRepoForm(false);
      setNotice('Imported ' + result.repository.name + ' (' + result.repository.type + '). Review its files before trusting it.');
    } catch (error) { setNotice(formatError(error)); }
    finally { setBusy(''); }
  }

  async function removeRepository(repo) {
    if (!window.confirm('Remove imported repository "' + repo.name + '" from CO-Agent?\n\nThis deletes its managed copy. It does not delete the GitHub repository.')) return;
    setBusy('remove:' + repo.slug);
    try {
      const result = await desktop.integrations.removeRepo(repo.slug);
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Removal failed.');
      setRepos(old => old.filter(item => item.slug !== repo.slug));
      onSkillsChange(selectedSkills.filter(slug => slug !== repo.slug));
      setNotice('Removed ' + repo.name + ' from the local extensions folder.');
    } catch (error) { setNotice(formatError(error)); }
    finally { setBusy(''); }
  }

  async function previewSkill(repo) {
    if (skillPreviews[repo.slug] !== undefined) {
      setSkillPreviews(old => { const next = { ...old }; delete next[repo.slug]; return next; });
      return;
    }
    setBusy('preview:' + repo.slug);
    try {
      const result = await desktop.integrations.getSkills([repo.slug]);
      setSkillPreviews(old => ({ ...old, [repo.slug]: result?.[0]?.content || 'SKILL.md could not be read safely.' }));
    } catch (error) { setNotice(formatError(error)); }
    finally { setBusy(''); }
  }

  function toggleSkill(repo, checked) {
    onSkillsChange(checked ? [...new Set([...selectedSkills, repo.slug])].slice(0, 8) : selectedSkills.filter(slug => slug !== repo.slug));
  }

  return <section className="integrations-view">
    <div className="integrations-heading">
      <div><p className="eyebrow">EXTEND YOUR WORKSPACE</p><h1>Integrations & plugins</h1><p className="subhead">Manage optional local tools, import skills from GitHub, and choose which trusted skill notes CO-Agent may use in chat.</p></div>
      <button className="secondary-button" onClick={refresh} disabled={busy !== ''}><RefreshCw size={14}/> Refresh</button>
    </div>

    <div className="integration-banner"><div className="integration-banner-icon"><ShieldCheck size={21}/></div><div><strong>Optional by design. Review before you trust.</strong><p>Chat works without these extras. OCR, video rendering, and voice add capabilities when you need them. Imported repositories are not executed automatically.</p></div></div>

    <div className="integration-section-heading"><div><h2>Local tools</h2><p>Install only the capabilities you want. Core CO-Agent stays lightweight.</p></div><span className="section-count">{status?.tools?.filter(t => t.installed).length || 0} ready</span></div>
    <div className="integration-cards">
      {(status?.tools || [
        {id:'tesseract',name:'Tesseract OCR',description:'Local image-to-text extraction.',installed:false,loading:true},
        {id:'hyperframes',name:'Hyperframes',description:'HTML/CSS to MP4 video rendering.',installed:false,loading:true},
        {id:'piper',name:'Piper TTS',description:'Optional local text-to-speech.',installed:false,loading:true}
      ]).map(tool => {
        const Icon = tool.id === 'tesseract' ? ScanText : tool.id === 'hyperframes' ? Clapperboard : tool.id === 'git' ? FolderGit2 : Volume2;
        const installBusy = busy === tool.id;
        return <article className="integration-card" key={tool.id}>
          <div className="integration-card-top"><span className="integration-icon"><Icon size={20}/></span><span className={tool.installed ? 'integration-state ready' : 'integration-state optional'}>{tool.installed ? <CheckCircle2 size={13}/> : <Circle size={13}/>} {tool.installed ? 'Installed' : 'Optional'}</span></div>
          <h3>{tool.name}</h3><p>{tool.description}</p>
          <div className="integration-card-meta">{tool.version ? <span>{tool.version}</span> : <span>{tool.kind === 'external-runtime' ? 'Manual setup' : tool.kind === 'repository-runtime' ? 'Needed for GitHub imports' : 'External dependency'}</span>}{tool.required && <span>Required</span>}</div>
          <div className="integration-card-actions">{tool.installAvailable ? <button className="secondary-button" disabled={!!busy} onClick={() => installTool(tool)}><Download size={14}/>{installBusy ? 'Installing…' : tool.installed ? 'Reinstall / update' : 'Install'}</button> : <button className="secondary-button" onClick={() => GenOpen(tool.docs || docs[tool.id])}><ExternalLink size={14}/> Setup guide</button>}<button className="text-link" onClick={() => GenOpen(tool.docs || docs[tool.id])}>Documentation <ExternalLink size={12}/></button></div>
          {!tool.installed && <p className="integration-note">{tool.id === 'tesseract' ? 'Windows installer uses winget. Other platforms: follow the official guide.' : tool.id === 'hyperframes' ? 'Requires Node.js and FFmpeg. The CLI remains a separate install.' : 'Piper and voice models must be installed/configured separately.'}</p>}
        </article>;
      })}
    </div>

    <div className="integration-section-heading repo-heading"><div><h2>GitHub repositories & skills</h2><p>Like a skill installer: provide a repository URL and optionally pin a branch or tag.</p></div><button className="primary-button" onClick={() => setShowRepoForm(value => !value)}><Github size={15}/>{showRepoForm ? 'Close form' : 'Import repository'}</button></div>

    {showRepoForm && <form className="repo-install-form" onSubmit={installRepository}>
      <div className="repo-form-intro"><FolderGit2 size={19}/><div><strong>Import from GitHub</strong><p>Public HTTPS GitHub repositories only. CO-Agent clones files for review; it does not execute code or install dependencies.</p></div></div>
      <label>Repository URL<input value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://github.com/owner/repo"/></label>
      <label>Branch, tag, or ref <span>(optional)</span><input value={ref} onChange={e => setRef(e.target.value)} placeholder="main, v1.2.0, or a branch name"/></label>
      <div className="repo-form-footer"><span><AlertTriangle size={14}/> Treat third-party content as untrusted until reviewed.</span><button className="primary-button" type="submit" disabled={busy !== '' || !url.trim()}>{busy === 'repo' ? <><LoaderCircle size={14} className="spin"/> Importing…</> : <><Download size={14}/> Import & inspect</>}</button></div>
    </form>}

    {repos.length ? <div className="installed-repos">{repos.map(repo => <article className="installed-repo" key={repo.slug}>
      <div className="installed-repo-icon">{repo.hasSkill ? <Sparkles size={18}/> : <Package size={18}/>}</div>
      <div className="installed-repo-body"><div className="installed-repo-title"><strong>{repo.name}</strong><span className="repo-type">{repo.type}</span></div><p>{repo.description || 'No description provided.'}</p><a href={repo.url} onClick={e => { e.preventDefault(); GenOpen(repo.url); }}>{repo.url} <ExternalLink size={11}/></a><div className="repo-flags">{repo.hasSkill && <span>SKILL.md detected</span>}{repo.hasPluginManifest && <span>Plugin manifest detected</span>}{repo.hasPackageJson && <span>package.json detected</span>}{repo.installScripts?.length > 0 && <span className="warning-flag">Install scripts: {repo.installScripts.join(', ')}</span>}</div>
        {repo.hasSkill && <><button className="secondary-button preview-skill-button" disabled={busy === 'preview:' + repo.slug} onClick={() => previewSkill(repo)}>{busy === 'preview:' + repo.slug ? 'Loading preview…' : skillPreviews[repo.slug] !== undefined ? 'Hide SKILL.md preview' : 'Review SKILL.md before enabling'}</button>{skillPreviews[repo.slug] !== undefined && <pre className="skill-preview">{skillPreviews[repo.slug]}</pre>}<label className="skill-toggle"><input type="checkbox" checked={selectedSkills.includes(repo.slug)} onChange={e => toggleSkill(repo, e.target.checked)}/><span><strong>Use this skill in local chat</strong><small>Its SKILL.md instructions are added as third-party context only while selected. Maximum 8 skills.</small></span></label></>}
        <p className="repo-safety-note"><ShieldCheck size={13}/> Files imported only. No plugin code or install scripts have been run.</p>
      </div>
      <button className="icon-button danger" title="Remove imported repository" disabled={!!busy} onClick={() => removeRepository(repo)}><Trash2 size={15}/></button>
    </article>)}</div> : <div className="empty-integrations"><FolderGit2 size={25}/><strong>No repositories imported</strong><span>Import a public GitHub repo containing a SKILL.md, plugin manifest, or package.json to review it here.</span><button className="secondary-button" onClick={() => setShowRepoForm(true)}>Import your first repository</button></div>}

    <div className="integration-footnote"><AlertTriangle size={15}/><p><strong>Safety boundary:</strong> A repository can contain arbitrary code. CO-Agent currently imports and inspects files; it does not activate generic plugin code or install its dependencies. Only explicitly selected <code>SKILL.md</code> text is added to local Ollama chat. Review it first and never paste secrets into untrusted skills.</p></div>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
    <p className="integration-path">Managed imports are stored under the CO-Agent user-data folder in <code>extensions/</code>. Repository files stay on this device unless you separately share or upload them.</p>
  </section>;
}

function GenOpen(url) {
  if (url && /^https:\/\//i.test(url)) window.coAgent?.openExternal ? window.coAgent.openExternal(url) : window.open(url, '_blank', 'noopener,noreferrer');
}
