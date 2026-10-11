import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Plus, MessageSquare, Video, Settings2, ArrowUp, Paperclip, Sparkles, ChevronDown, Monitor, Cpu, CircleHelp, RefreshCw, Download, Trash2, CheckCircle2, AlertCircle, Plug, MousePointer2, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import VideoEditor from './VideoEditor.jsx';
import Integrations from './Integrations.jsx';
import ComputerUse from './ComputerUse.jsx';
import Agents from './Agents.jsx';

const desktop = window.coAgent;
const starterPrompts = [
  { title: 'Plan a project', text: 'Break a goal into clear steps and help me execute them.' },
  { title: 'Work with files', text: 'Help me organize, inspect, and transform project files.' },
  { title: 'Create something', text: 'Help me develop a creative idea into a finished result.' }
];

export default function App() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [section, setSection] = useState('Chat');
  const [busy, setBusy] = useState(false);
  const [runtime, setRuntime] = useState({ loading: true, available: false, models: [], error: '' });
  const [selectedModel, setSelectedModel] = useState('');
  const [notice, setNotice] = useState('');
  const [modelToInstall, setModelToInstall] = useState('gemma3:4b');
  const [selectedSkills, setSelectedSkills] = useState([]);

  const refreshRuntime = useCallback(async () => {
    if (!desktop?.runtime?.ollamaStatus) { setRuntime({ loading: false, available: false, models: [], error: 'Desktop bridge is unavailable. Open CO-Agent in Electron.' }); return; }
    setRuntime(old => ({ ...old, loading: true }));
    try {
      const result = await desktop.runtime.ollamaStatus();
      setRuntime({ loading: false, available: !!result?.available, models: result?.models || [], error: result?.error || '' });
      if (!selectedModel && result?.models?.length) setSelectedModel(result.models[0].name || result.models[0].model || '');
    } catch (error) { setRuntime({ loading: false, available: false, models: [], error: error.message || String(error) }); }
  }, [selectedModel]);

  useEffect(() => { refreshRuntime(); }, []);

  const send = async (text = message) => {
    const value = text.trim();
    if (!value || busy) return;
    const next = [...messages, { role: 'user', content: value }];
    setMessages(next); setMessage(''); setBusy(true); setNotice('');
    try {
      const result = await desktop.runtime.chat({ provider: 'ollama', model: selectedModel || undefined, skills: selectedSkills, messages: next.map(m => ({ role: m.role, content: m.content })) });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'The AI request failed.');
      setMessages(old => [...old, { role: 'assistant', content: result.message || 'The model returned an empty response.' }]);
    } catch (error) {
      setMessages(old => [...old, { role: 'assistant', content: 'I could not complete that request. ' + (error.message || String(error)) + '\n\nCheck that Ollama is running, a model is installed, and a model is selected in Settings.' }]);
    } finally { setBusy(false); }
  };

  async function installModel() {
    if (!modelToInstall.trim()) return;
    setBusy(true); setNotice('Starting model pull. Large downloads may take a while.');
    try {
      const result = await desktop.runtime.pullModel(modelToInstall.trim());
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Model download failed.');
      setNotice('Model download completed: ' + modelToInstall.trim());
      setSelectedModel(modelToInstall.trim());
      await refreshRuntime();
    } catch (error) { setNotice(error.message || String(error)); }
    finally { setBusy(false); }
  }
  async function deleteModel(model) {
    if (!window.confirm('Remove local model "' + model + '" from Ollama?')) return;
    setNotice('');
    try {
      const result = await desktop.runtime.deleteModel(model);
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Delete failed.');
      if (selectedModel === model) setSelectedModel('');
      setNotice('Removed model: ' + model);
      await refreshRuntime();
    } catch (error) { setNotice(error.message || String(error)); }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Bot size={19}/></span><span>CO-Agent</span><span className="version">0.6.1</span></div>
      <button className="new-chat" title="Start a new conversation" aria-label="Start a new conversation" onClick={() => { setSection('Chat'); setMessages([]); setNotice(''); }}><Plus size={17}/> New chat</button>
      <div className="nav-label">WORKSPACE</div>
      <button className={'nav-item ' + (section === 'Chat' ? 'active' : '')} title="Chat" aria-label="Chat" aria-current={section === 'Chat' ? 'page' : undefined} onClick={() => setSection('Chat')}><MessageSquare size={17}/> Chat</button>
      <button className={'nav-item ' + (section === 'Video Studio' ? 'active' : '')} title="Video Studio" aria-label="Video Studio" aria-current={section === 'Video Studio' ? 'page' : undefined} onClick={() => setSection('Video Studio')}><Video size={17}/> Video Studio</button>
      <button className={'nav-item ' + (section === 'Agents' ? 'active' : '')} title="Agents & terminal" aria-label="Agents and terminal" aria-current={section === 'Agents' ? 'page' : undefined} onClick={() => setSection('Agents')}><BrainCircuit size={17}/> Agents & terminal</button>
      <button className={'nav-item ' + (section === 'Computer Use' ? 'active' : '')} title="Computer Use" aria-label="Computer Use" aria-current={section === 'Computer Use' ? 'page' : undefined} onClick={() => setSection('Computer Use')}><MousePointer2 size={17}/> Computer Use</button>
      <button className={'nav-item ' + (section === 'Integrations' ? 'active' : '')} title="Integrations" aria-label="Integrations" aria-current={section === 'Integrations' ? 'page' : undefined} onClick={() => setSection('Integrations')}><Plug size={17}/> Integrations</button>
      <div className="sidebar-bottom">
        <div className="runtime"><span className="status-dot" style={{background:runtime.available?'#4e9c70':'#c7a15b'}}/><div><strong>{runtime.available ? 'Ollama connected' : 'Runtime not connected'}</strong><small>{runtime.available ? runtime.models.length + ' local model(s) found' : 'Check local AI status'}</small></div></div>
        <button className={'nav-item ' + (section === 'Settings' ? 'active' : '')} title="Models & settings" aria-label="Models and settings" aria-current={section === 'Settings' ? 'page' : undefined} onClick={() => setSection('Settings')}><Settings2 size={17}/> Models & settings</button>
        <button className={'nav-item muted ' + (section === 'Help' ? 'active' : '')} title="Help & diagnostics" aria-label="Help and diagnostics" aria-current={section === 'Help' ? 'page' : undefined} onClick={() => setSection('Help')}><CircleHelp size={17}/> Help & diagnostics</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb"><span>{section}</span><ChevronDown size={14}/></div><div className="top-actions"><span className="local-pill"><span className="status-dot" style={{background:runtime.available?'#4e9c70':'#c7a15b'}}/> {runtime.available ? 'Local AI ready' : 'Local-first'}</span><button className="icon-button" title="Refresh runtime" onClick={refreshRuntime}><RefreshCw size={16}/></button><button className="icon-button" title="Settings" onClick={() => setSection('Settings')}><Settings2 size={17}/></button></div></header>
      {section === 'Agents' ? <Agents/> : section === 'Computer Use' ? <ComputerUse/> : section === 'Integrations' ? <Integrations selectedSkills={selectedSkills} onSkillsChange={setSelectedSkills}/> : section === 'Chat' ? <section className="chat-view">
        {messages.length === 0 ? <div className="welcome"><div className="welcome-icon"><Sparkles size={22}/></div><p className="eyebrow">YOUR DESKTOP AI WORKSPACE</p><h1>What can we work on?</h1><p className="subhead">Chat, create, and plan your next task in one workspace.</p><div className="starter-grid">{starterPrompts.map(item => <button className="starter" key={item.title} onClick={() => send(item.text)}><strong>{item.title}</strong><span>{item.text}</span><ArrowUp size={15}/></button>)}</div>{!runtime.available && <p className="runtime-warning"><AlertCircle size={15}/> Ollama is not connected yet. Open Models & settings to diagnose it.</p>}</div> : <div className="messages">{messages.map((item, i) => <article className={'message ' + item.role} key={i}><div className="avatar">{item.role === 'user' ? 'You' : <Bot size={17}/>}</div><div className="message-content"><strong>{item.role === 'user' ? 'You' : 'CO-Agent'}</strong><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown></div></div></article>)}{busy && <article className="message assistant"><div className="avatar"><Bot size={17}/></div><div><strong>CO-Agent</strong><p className="typing">Working on it…</p></div></article>}</div>}
        <div className="composer-wrap"><form className="composer" onSubmit={e => { e.preventDefault(); send(); }}><textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message CO-Agent…" rows={2}/><div className="composer-footer"><div className="composer-tools">{selectedSkills.length > 0 && <span className="active-skill-pill" title="Selected repository skills are included as untrusted context"><Sparkles size={12}/>{selectedSkills.length} skill{selectedSkills.length === 1 ? '' : 's'}</span>}<button type="button" className="tool-button" title="Import files" onClick={async()=>{try{const files=await desktop.dialog.openFiles({multiple:true});if(files?.length)setNotice('Selected files: '+files.join(', '));}catch(e){setNotice(e.message||String(e));}}}><Paperclip size={16}/></button><label className="model-label"><Cpu size={14}/><select value={selectedModel} onChange={e=>setSelectedModel(e.target.value)} aria-label="Select model"><option value="">{runtime.available?'Choose model':'No model connected'}</option>{runtime.models.map(m=><option key={m.name||m.model} value={m.name||m.model}>{m.name||m.model}</option>)}</select></label></div><button className="send-button" type="submit" disabled={!message.trim() || busy} aria-label="Send message"><ArrowUp size={18}/></button></div></form><p className="disclaimer">CO-Agent can make mistakes. Review actions before running them on your computer.</p>{notice && <p className="inline-notice" role="status">{notice}</p>}</div>
      </section> : section === 'Video Studio' ? <VideoEditor/> : section === 'Settings' ? <section className="settings-view"><div className="settings-heading"><p className="eyebrow">LOCAL RUNTIME</p><h1>Models & settings</h1><p className="subhead">Connect your local Ollama runtime, choose a model, and manage downloads.</p></div><div className="settings-card"><div className="settings-card-heading"><div><h2>Ollama status</h2><p>{runtime.available ? 'Connected to the local Ollama API.' : runtime.error || 'Could not reach Ollama at 127.0.0.1:11434.'}</p></div><button className="secondary-button" onClick={refreshRuntime}><RefreshCw size={14}/> Refresh</button></div><div className="runtime-detail"><span className={runtime.available?'cap-ok':'cap-missing'}>{runtime.available?<CheckCircle2 size={14}/>:<AlertCircle size={14}/>} {runtime.available?'Connected':'Disconnected'}</span><span>Endpoint: http://127.0.0.1:11434</span></div></div><div className="settings-card"><h2>Installed models</h2>{runtime.models.length ? <div className="model-list">{runtime.models.map(m=>{const model=m.name||m.model;return <div className="model-row" key={model}><Cpu size={16}/><button className="model-select" onClick={()=>setSelectedModel(model)}><strong>{model}</strong><small>{m.size ? (m.size/1e9).toFixed(1)+' GB' : 'Local model'}{selectedModel===model?' · selected':''}</small></button><button className="icon-button danger" title="Delete model" onClick={()=>deleteModel(model)}><Trash2 size={15}/></button></div>})}</div>:<p className="empty-state">No models detected. Start Ollama and install a model below.</p>}</div><div className="settings-card"><h2>Download a model</h2><p>Model downloads are stored by Ollama and may require several gigabytes of disk space.</p><div className="model-install"><input value={modelToInstall} onChange={e=>setModelToInstall(e.target.value)} placeholder="e.g. gemma3:4b"/><button className="primary-button" disabled={busy||!modelToInstall.trim()} onClick={installModel}><Download size={15}/>{busy?'Working…':'Pull model'}</button></div><div className="quick-models">{['gemma3:4b','qwen2.5:3b','phi4-mini'].map(m=><button key={m} onClick={()=>setModelToInstall(m)}>{m}</button>)}</div></div>{notice && <p className="inline-notice" role="status">{notice}</p>}</section> : <section className="settings-view"><div className="settings-heading"><p className="eyebrow">DIAGNOSTICS</p><h1>Help & diagnostics</h1><p className="subhead">Check the local runtime and supported desktop capabilities.</p></div><div className="settings-card"><h2>Runtime checks</h2><p>Ollama: {runtime.loading?'checking…':runtime.available?'reachable':'unavailable'}</p><p>Platform: {desktop?.platform || 'browser preview'}</p><p>Computer control is deliberately limited to explicit allow-listed app launches and opening a selected path. It does not run arbitrary shell commands.</p><button className="secondary-button" onClick={refreshRuntime}><RefreshCw size={14}/> Run checks</button></div></section>}
    </main>
  </div>;
}
