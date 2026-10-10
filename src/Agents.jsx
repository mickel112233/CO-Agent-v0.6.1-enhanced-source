import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, BrainCircuit, CheckCircle2, Circle, Clock3, Code2, FileCode2, FolderOpen, GitBranch, ListChecks, LoaderCircle, Play, RefreshCw, ShieldCheck, Sparkles, Terminal, Trash2, Wrench, XCircle } from 'lucide-react';

const desktop = window.coAgent;
const DEFAULT_GOAL = 'Inspect this project, identify the highest-impact improvements, implement a focused fix, review it independently, and run tests and a production build.';
const STATUS = {
  queued: { label: 'Queued', icon: Circle },
  running: { label: 'Running', icon: LoaderCircle },
  done: { label: 'Done', icon: CheckCircle2 },
  blocked: { label: 'Blocked', icon: XCircle }
};
const errorText = error => error?.message || String(error);

export default function Agents() {
  const [goal, setGoal] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [agentCatalog, setAgentCatalog] = useState({ agents: [], skills: [] });
  const [results, setResults] = useState({});
  const [activeResult, setActiveResult] = useState('');
  const [commands, setCommands] = useState([]);
  const [commandId, setCommandId] = useState('npm-test');
  const [terminalLog, setTerminalLog] = useState([]);
  const [terminalStatus, setTerminalStatus] = useState('idle');
  const [terminalResult, setTerminalResult] = useState(null);

  const refreshFiles = useCallback(async () => {
    if (!desktop?.workspace) return;
    try {
      const [rootResult, listing] = await Promise.all([desktop.workspace.getRoot(), desktop.workspace.listFiles({ maxFiles: 500 })]);
      setWorkspaceRoot(rootResult?.root || '');
      if (listing?.ok) setFiles(listing.files || []);
      else if (listing?.error) setNotice(listing.error);
    } catch (error) { setNotice(errorText(error)); }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        const [runtime, catalog, commandList, rootResult] = await Promise.all([
          desktop?.runtime?.ollamaStatus?.(),
          desktop?.agents?.list?.(),
          desktop?.terminal?.listCommands?.(),
          desktop?.workspace?.getRoot?.()
        ]);
        setModels(runtime?.models || []);
        setModel(runtime?.models?.[0]?.name || runtime?.models?.[0]?.model || '');
        setAgentCatalog({ agents: catalog?.agents || [], skills: catalog?.skills || [] });
        setCommands(commandList?.commands || []);
        setWorkspaceRoot(rootResult?.root || '');
        if (rootResult?.root) await refreshFiles();
      } catch (error) { setNotice(errorText(error)); }
    })();
    if (desktop?.terminal?.onOutput) unsubscribe = desktop.terminal.onOutput(event => {
      setTerminalLog(old => [...old, { stream: event.stream || 'stdout', text: event.text || '' }].slice(-800));
      setTerminalStatus('running');
    });
    return () => unsubscribe();
  }, [refreshFiles]);

  const doneCount = useMemo(() => (workflow?.pipeline || []).filter(step => step.status === 'done').length, [workflow]);
  const selectedFiles = useMemo(() => files.filter(file => selectedPaths.includes(file.path)), [files, selectedPaths]);
  const chooseWorkspace = async () => {
    setBusy('workspace'); setNotice('');
    try {
      const result = await desktop.workspace.chooseRoot();
      if (result?.canceled) return;
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Could not select a workspace.');
      setWorkspaceRoot(result.root || '');
      setSelectedPaths([]);
      setWorkflow(null); setResults({});
      const listing = await desktop.workspace.listFiles({ maxFiles: 500 });
      if (listing?.ok) setFiles(listing.files || []);
      setNotice('Workspace selected. Files are only read or changed when you request it.');
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(''); }
  };

  const createPlan = async event => {
    event?.preventDefault();
    if (!goal.trim() || busy) return;
    setBusy('plan'); setNotice('Lead planner is creating a reviewable pipeline with local AI…'); setWorkflow(null); setResults({}); setActiveResult('');
    try {
      const result = await desktop.agents.planWorkflow({ goal: goal.trim(), model });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Workflow planning failed.');
      setWorkflow(result);
      setNotice('Created ' + result.pipeline.length + ' steps using ' + result.model + '. Nothing has been changed or executed yet.');
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(''); }
  };

  const runStep = async step => {
    if (!workflow || busy) return;
    const pendingDependencies = (step.dependsOn || []).filter(id => workflow.pipeline.find(item => item.id === id)?.status !== 'done');
    if (pendingDependencies.length) { setNotice('Complete the prerequisite steps first.'); return; }
    setBusy(step.id); setNotice('Running ' + step.role + ' agent with the ' + step.skill + ' skill…');
    setWorkflow(old => ({ ...old, pipeline: old.pipeline.map(item => item.id === step.id ? { ...item, status: 'running' } : item) }));
    try {
      const contextFiles = [];
      for (const relativePath of selectedPaths.slice(0, 8)) {
        const item = await desktop.workspace.readFile(relativePath);
        if (item?.ok === false || item?.error) throw new Error(item.error || ('Could not read ' + relativePath));
        contextFiles.push({ path: item.path, content: item.content });
      }
      const priorResults = workflow.pipeline.filter(item => item.status === 'done' && results[item.id]).map(item => ({
        title: item.title, role: item.role, result: JSON.stringify(results[item.id]).slice(0, 5000)
      }));
      const result = await desktop.agents.runStep({ goal: workflow.goal, step, priorResults, contextFiles, model });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Agent step failed.');
      setResults(old => ({ ...old, [step.id]: result }));
      setActiveResult(step.id);
      setWorkflow(old => ({ ...old, pipeline: old.pipeline.map(item => item.id === step.id ? { ...item, status: 'done', result: result.summary } : item) }));
      setNotice(step.title + ' completed. ' + (result.files?.length ? result.files.length + ' file proposal(s) await your review.' : 'No files were changed.'));
    } catch (error) {
      setWorkflow(old => ({ ...old, pipeline: old.pipeline.map(item => item.id === step.id ? { ...item, status: 'blocked', result: errorText(error) } : item) }));
      setNotice(errorText(error));
    } finally { setBusy(''); }
  };

  const applyProposals = async stepId => {
    const result = results[stepId];
    if (!result?.files?.length || busy) return;
    setBusy('apply'); setNotice('Waiting for native approval…');
    try {
      const applied = await desktop.workspace.applyChanges({ files: result.files });
      if (applied?.ok === false || applied?.error) throw new Error(applied.error || 'Could not apply file proposals.');
      setResults(old => ({ ...old, [stepId]: { ...old[stepId], files: [], applied: applied.applied, backupDirectory: applied.backupDirectory } }));
      await refreshFiles();
      setNotice('Applied ' + (applied.applied || []).length + ' file(s). Backups: ' + applied.backupDirectory);
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(''); }
  };

  const runTerminal = async () => {
    if (!workspaceRoot || !commandId || busy || terminalStatus === 'running') return;
    setBusy('terminal'); setTerminalStatus('running'); setTerminalResult(null); setTerminalLog([]);
    setNotice('A native confirmation will appear before the command runs.');
    try {
      const result = await desktop.terminal.runCommand(commandId);
      if (result?.ok === false && result?.error) throw new Error(result.error);
      setTerminalResult(result);
      setTerminalStatus(result?.ok ? 'success' : 'failed');
      if (result?.output && !terminalLog.length) setTerminalLog([{ stream: 'stdout', text: result.output }]);
      setNotice(result?.ok ? 'Command completed successfully.' : (result?.timedOut ? 'Command timed out.' : 'Command exited with code ' + result?.exitCode + '. Review terminal output.'));
    } catch (error) {
      setTerminalStatus('failed'); setNotice(errorText(error));
    } finally { setBusy(''); }
  };
  const stopTerminal = async () => {
    try { const result = await desktop.terminal.cancelCommand(); setNotice(result?.ok ? 'Stop requested.' : result?.error || 'No command is running.'); }
    catch (error) { setNotice(errorText(error)); }
  };

  return <section className="agents-view">
    <div className="agents-heading">
      <div><p className="eyebrow">ORCHESTRATION · HARNESS · TOOLING</p><h1>Agent workspace</h1><p className="subhead">Plan a task, delegate specialist steps, inspect proposed changes, and run real project tests and builds with approval.</p></div>
      <div className="agents-heading-mark"><BrainCircuit size={26}/><span>Local-first harness</span></div>
    </div>

    <div className="agents-safety"><ShieldCheck size={19}/><div><strong>You stay in control</strong><p>Agents propose plans and file changes. Applying files and running terminal commands require separate native confirmation. Model output is untrusted; nothing runs automatically.</p></div></div>

    <div className="agents-workspace-bar">
      <div className="agents-workspace-path"><FolderOpen size={17}/><div><strong>Project workspace</strong><span title={workspaceRoot}>{workspaceRoot || 'No folder selected yet'}</span></div></div>
      <button className="secondary-button" onClick={chooseWorkspace} disabled={!!busy}><FolderOpen size={14}/>{workspaceRoot ? 'Change folder' : 'Choose project'}</button>
      {workspaceRoot && <button className="secondary-button" onClick={refreshFiles} disabled={!!busy}><RefreshCw size={14}/> Refresh files</button>}
    </div>

    <div className="agents-grid">
      <div className="agents-main-column">
        <form className="agents-plan-card" onSubmit={createPlan}>
          <div className="agents-card-heading"><span className="agents-icon"><Sparkles size={17}/></span><div><h2>Task brief</h2><p>Describe the outcome. The lead planner will build a dependency-aware pipeline.</p></div></div>
          <textarea value={goal} onChange={event => setGoal(event.target.value)} placeholder="What should the agent team accomplish?" rows={4} maxLength={5000}/>
          <div className="agents-plan-controls"><label>Local model<select value={model} onChange={event => setModel(event.target.value)}><option value="">Choose model</option>{models.map(item => <option key={item.name || item.model} value={item.name || item.model}>{item.name || item.model}</option>)}</select></label><button className="primary-button" disabled={!goal.trim() || !!busy || !model}><Sparkles size={14}/>{busy === 'plan' ? 'Planning…' : 'Create workflow'}</button></div>
          {!models.length && <p className="agents-inline-warning">Ollama is not available or no models are installed. Connect Ollama and choose a model in Models & settings.</p>}
        </form>

        {workflow ? <div className="agents-pipeline-card">
          <div className="agents-pipeline-title"><div><p className="eyebrow">ACTIVE WORKFLOW</p><h2>{workflow.title}</h2><p>{workflow.goal}</p></div><span className="agents-progress">{doneCount}/{workflow.pipeline.length} done</span></div>
          <div className="agents-progress-track"><span style={{ width: (doneCount / Math.max(1, workflow.pipeline.length) * 100) + '%' }}/></div>
          <div className="agents-step-list">{workflow.pipeline.map((step, index) => {
            const status = STATUS[step.status] || STATUS.queued; const StatusIcon = status.icon;
            const blockedBy = (step.dependsOn || []).filter(id => workflow.pipeline.find(item => item.id === id)?.status !== 'done');
            const result = results[step.id];
            return <article className={'agents-step ' + step.status} key={step.id}>
              <div className="agents-step-index"><StatusIcon size={17}/><span>{String(index + 1).padStart(2, '0')}</span></div>
              <div className="agents-step-body">
                <div className="agents-step-heading"><h3>{step.title}</h3><span className={'agents-status ' + step.status}>{status.label}</span></div>
                <p>{step.description}</p>
                <div className="agents-step-meta"><span><Bot size={12}/>{step.role}</span><span><Wrench size={12}/>{step.skill}</span><span><ListChecks size={12}/>{step.acceptanceCriteria?.length || 0} criteria</span></div>
                {step.dependsOn?.length > 0 && <small className="agents-dependencies">Depends on: {step.dependsOn.join(', ')}</small>}
                <div className="agents-step-actions">
                  <button className="secondary-button" disabled={!!busy || step.status === 'running' || blockedBy.length > 0} onClick={() => runStep(step)}><Play size={13}/>{busy === step.id ? 'Running…' : step.status === 'done' ? 'Run again' : 'Run agent step'}</button>
                  {result && <button className="text-link" onClick={() => setActiveResult(activeResult === step.id ? '' : step.id)}>{activeResult === step.id ? 'Hide result' : 'View result'}</button>}
                  {blockedBy.length > 0 && <small>Finish dependencies first</small>}
                </div>
                {activeResult === step.id && result && <div className="agents-result">
                  <div className="agents-result-summary"><strong>{result.role} · {result.skill}</strong><span>{result.model}</span></div>
                  <p>{result.summary}</p>
                  {result.findings?.length > 0 && <><h4>Findings</h4><ul>{result.findings.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
                  {result.risks?.length > 0 && <><h4>Risks to review</h4><ul className="agents-risk-list">{result.risks.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
                  {result.needsUserInput && <p className="agents-inline-warning">Agent asks: {result.userQuestion || 'Please clarify the task.'}</p>}
                  {result.files?.length > 0 && <div className="agents-file-proposals"><h4><FileCode2 size={14}/> Proposed file changes ({result.files.length})</h4>{result.files.map(file => <details key={file.path}><summary>{file.path} <span>{file.content.length.toLocaleString()} chars</span></summary><pre>{file.content}</pre></details>)}<button className="primary-button" onClick={() => applyProposals(step.id)} disabled={!!busy}><ShieldCheck size={14}/> Review and apply files</button></div>}
                  {result.applied?.length > 0 && <div className="agents-applied"><CheckCircle2 size={14}/> Applied {result.applied.length} file(s); backup folder created.</div>}
                  {result.suggestedCommands?.length > 0 && <div className="agents-suggested-commands"><strong>Suggested terminal checks</strong>{result.suggestedCommands.map(id => {const cmd=commands.find(item => item.id === id);return cmd ? <button key={id} onClick={() => {setCommandId(id);setNotice('Selected terminal command: '+cmd.label);}}>{cmd.label}</button> : null})}</div>}
                </div>}
              </div>
            </article>;
          })}</div>
          <div className="agents-pipeline-footer"><span><CheckCircle2 size={14}/>{doneCount} of {workflow.pipeline.length} steps completed</span><button className="text-link" onClick={() => {setWorkflow(null);setResults({});setActiveResult('');}}>Clear workflow</button></div>
        </div> : <div className="agents-empty-pipeline"><GitBranch size={25}/><strong>Your workflow pipeline appears here</strong><span>Create a task brief to get a plan, dependencies, specialist assignments, acceptance criteria, and step-by-step results.</span></div>}

        <div className="agents-terminal-card">
          <div className="agents-card-heading"><span className="agents-icon"><Terminal size={17}/></span><div><h2>Project terminal</h2><p>Run allow-listed development commands inside the selected workspace. No arbitrary shell input.</p></div><span className={'terminal-status ' + terminalStatus}>{terminalStatus === 'running' ? 'Running' : terminalStatus === 'success' ? 'Passed' : terminalStatus === 'failed' ? 'Failed' : 'Idle'}</span></div>
          <div className="agents-terminal-controls"><label>Command<select value={commandId} onChange={event => setCommandId(event.target.value)} disabled={terminalStatus === 'running'}>{commands.map(command => <option key={command.id} value={command.id}>{command.label} — {command.command}</option>)}</select></label><button className="primary-button" onClick={runTerminal} disabled={!workspaceRoot || !!busy || terminalStatus === 'running'}><Play size={14}/> Run command</button>{terminalStatus === 'running' && <button className="secondary-button" onClick={stopTerminal}><XCircle size={14}/> Stop</button>}</div>
          {!workspaceRoot && <p className="agents-inline-warning">Choose a project folder before running terminal commands.</p>}
          <div className="agents-terminal-output" role="log" aria-live="polite">{terminalLog.length ? terminalLog.map((line, i) => <span key={i} className={line.stream}>{line.text}</span>) : <span className="terminal-placeholder">Terminal output will stream here. Run tests and build to verify actual project results.</span>}</div>
          {terminalResult && <div className={'agents-terminal-summary ' + (terminalResult.ok ? 'success' : 'failed')}><strong>{terminalResult.ok ? 'Exit code 0 · passed' : 'Exit code ' + terminalResult.exitCode + (terminalResult.timedOut ? ' · timed out' : ' · failed')}</strong><span>{terminalResult.label} · {terminalResult.cwd}</span></div>}
        </div>
      </div>

      <aside className="agents-side-column">
        <div className="agents-side-card"><div className="agents-side-heading"><BrainCircuit size={16}/><h2>Agent team</h2><span>{agentCatalog.agents.length}</span></div><p>Specialists share the same goal and completed step results, but work independently and cannot silently run tools.</p>{agentCatalog.agents.map(agent => <div className="agents-catalog-row" key={agent.id}><span className="agents-catalog-avatar"><Bot size={14}/></span><div><strong>{agent.name}</strong><small>{agent.purpose}</small></div></div>)}</div>
        <div className="agents-side-card"><div className="agents-side-heading"><Wrench size={16}/><h2>Built-in skills</h2><span>{agentCatalog.skills.length}</span></div><p>Reusable quality harnesses are injected into specialist prompts based on the assigned task.</p>{agentCatalog.skills.map(skill => <details className="agents-skill-row" key={skill.id}><summary><span>{skill.name}</span><small>{skill.category}</small></summary><p>{skill.description}</p></details>)}</div>
        <div className="agents-side-card"><div className="agents-side-heading"><ShieldCheck size={16}/><h2>Harness guardrails</h2></div><ul className="agents-guardrail-list"><li>Separate planning, implementation, review, and testing roles.</li><li>Dependencies prevent steps from running out of order.</li><li>File proposals are previewed before applying.</li><li>Existing files receive backups under .co-agent-backups.</li><li>Terminal commands use fixed presets and native confirmation.</li><li>Command output, exit code, timeout, and errors are visible.</li><li>Secrets, symlinks, and protected folders are blocked from file tools.</li></ul></div>
        {workspaceRoot && <div className="agents-side-card"><div className="agents-side-heading"><FileCode2 size={16}/><h2>Context files</h2><span>{selectedPaths.length}/8</span></div><p>Select files for agents to inspect. Only checked files are sent to the local model.</p><div className="agents-file-list">{files.map(file => <label key={file.path} title={file.path}><input type="checkbox" checked={selectedPaths.includes(file.path)} disabled={!selectedPaths.includes(file.path) && selectedPaths.length >= 8} onChange={event => setSelectedPaths(old => event.target.checked ? [...old, file.path] : old.filter(item => item !== file.path))}/><span>{file.path}</span><small>{file.size > 1024 ? Math.round(file.size / 1024) + ' KB' : file.size + ' B'}</small></label>)}</div><small className="agents-context-note">Sensitive filenames, dependencies, build output, and symlink entries are filtered by the workspace layer.</small></div>}
      </aside>
    </div>
    {notice && <p className="inline-notice agents-notice" role="status">{notice}</p>}
  </section>;
}
