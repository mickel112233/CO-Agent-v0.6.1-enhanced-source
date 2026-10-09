import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class RendererErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('CO-Agent renderer error:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="fatal">
      <section className="fatal-card">
        <p className="eyebrow">CO-Agent</p>
        <h1>The workspace hit a renderer error.</h1>
        <p>The app stayed open so you can see the error instead of a blank window.</p>
        <pre>{String(this.state.error?.stack || this.state.error)}</pre>
        <button onClick={() => window.location.reload()}>Reload workspace</button>
      </section>
    </main>;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><RendererErrorBoundary><App /></RendererErrorBoundary></React.StrictMode>
);
