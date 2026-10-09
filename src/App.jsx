import React, { useState } from 'react';
import { Bot, Plus, MessageSquare, Video, Settings2, ArrowUp, Paperclip, Sparkles, ChevronDown, Monitor, Cpu, CircleHelp } from 'lucide-react';

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

  function send(text = message) {
    const value = text.trim();
    if (!value || busy) return;
    setMessages(old => [...old, { role: 'user', text: value }]);
    setMessage('');
    setBusy(true);
    // The UI deliberately does not pretend a model is connected. Runtime integration
    // should be wired through the Electron preload bridge once the full backend lands.
    setTimeout(() => {
      setMessages(old => [...old, {
        role: 'assistant',
        text: 'The workspace UI is ready, but an AI provider is not connected in this repository build yet. Configure the local runtime or API provider when its backend integration is added.'
      }]);
      setBusy(false);
    }, 250);
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Bot size={19}/></span><span>CO-Agent</span><span className="version">0.6.1</span></div>
      <button className="new-chat" onClick={() => { setSection('Chat'); setMessages([]); }}><Plus size={17}/> New chat</button>
      <div className="nav-label">WORKSPACE</div>
      <button className={'nav-item ' + (section === 'Chat' ? 'active' : '')} onClick={() => setSection('Chat')}><MessageSquare size={17}/> Chat</button>
      <button className={'nav-item ' + (section === 'Video Studio' ? 'active' : '')} onClick={() => setSection('Video Studio')}><Video size={17}/> Video Studio</button>
      <div className="sidebar-bottom">
        <div className="runtime"><span className="status-dot"/><div><strong>Runtime not connected</strong><small>Local AI status unavailable</small></div></div>
        <button className="nav-item" onClick={() => setSection('Settings')}><Settings2 size={17}/> Settings</button>
        <button className="nav-item muted" onClick={() => setSection('Help')}><CircleHelp size={17}/> Help & diagnostics</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb"><span>{section}</span><ChevronDown size={14}/></div><div className="top-actions"><span className="local-pill"><span className="status-dot"/> Local-first</span><button className="icon-button" title="Settings" onClick={() => setSection('Settings')}><Settings2 size={17}/></button></div></header>
      {section === 'Chat' ? <section className="chat-view">
        {messages.length === 0 ? <div className="welcome">
          <div className="welcome-icon"><Sparkles size={22}/></div>
          <p className="eyebrow">YOUR DESKTOP AI WORKSPACE</p>
          <h1>What can we work on?</h1>
          <p className="subhead">Chat, create, and plan your next task in one workspace.</p>
          <div className="starter-grid">{starterPrompts.map(item => <button className="starter" key={item.title} onClick={() => send(item.text)}><strong>{item.title}</strong><span>{item.text}</span><ArrowUp size={15}/></button>)}</div>
        </div> : <div className="messages">{messages.map((item, i) => <article className={'message ' + item.role} key={i}><div className="avatar">{item.role === 'user' ? 'You' : <Bot size={17}/>}</div><div><strong>{item.role === 'user' ? 'You' : 'CO-Agent'}</strong><p>{item.text}</p></div></article>)}</div>}
        <div className="composer-wrap"><form className="composer" onSubmit={e => { e.preventDefault(); send(); }}><textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message CO-Agent…" rows={2}/><div className="composer-footer"><div className="composer-tools"><button type="button" className="tool-button" title="Attachments (not yet connected)"><Paperclip size={16}/></button><span className="model-label"><Cpu size={14}/> No model connected</span></div><button className="send-button" type="submit" disabled={!message.trim() || busy} aria-label="Send message"><ArrowUp size={18}/></button></div></form><p className="disclaimer">CO-Agent can make mistakes. Review actions before running them on your computer.</p></div>
      </section> : <section className="other-view"><div className="welcome-icon">{section === 'Video Studio' ? <Video size={22}/> : section === 'Settings' ? <Settings2 size={22}/> : <Monitor size={22}/>}</div><h1>{section}</h1><p className="subhead">{section === 'Video Studio' ? 'The video editor backend and timeline need to be restored from the complete source archive.' : section === 'Settings' ? 'Provider and runtime settings will appear here when the backend bridge is connected.' : 'Diagnostics and runtime checks are not connected in this repository build yet.'}</p><button className="secondary-button" onClick={() => setSection('Chat')}>Return to chat</button></section>}
    </main>
  </div>;
}
