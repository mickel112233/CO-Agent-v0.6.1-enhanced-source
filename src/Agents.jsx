import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bot, BrainCircuit, CheckCircle2, Circle, FileCode2, FolderOpen, Gauge, GitBranch, Layers, ListChecks, LoaderCircle, Play, RefreshCw, ShieldCheck, Sparkles, Terminal, Wrench, XCircle } from 'lucide-react';

const desktop = window.coAgent;
const STATUS = {
  queued: { label: 'Queued', icon: Circle },
  running: { label: 'Running', icon: LoaderCircle },
  done: { label: 'Done', icon: CheckCircle2 },
  blocked: { label: 'Blocked', icon: XCircle },
  review: { label: 'Review checkpoint', icon: ShieldCheck }
};
const errorText = error => error?.message || String(error);
const readSavedState = (key, fallback) => { try { const value = window.localStorage.getItem(key); return value == null ? fallback : JSON.parse(value); } catch { return fallback; } };

export default function Agents() {
  const [goal, setGoal] = useState(() => readSavedState('co-agent:agent-goal', ''));
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [files, setFiles] = useState([]);
  const [filesTruncated, setFilesTruncated] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(() => readSavedState('co-agent:agent-context-paths', []));
  const [importedRepos, setImportedRepos] = useState([]);
  const [selectedExternalSkills, setSelectedExternalSkills] = useState(() => readSavedState('co-agent:agent-external-skills', []));
  const [workflow, setWorkflow] = useState(() => readSavedState('co-agent:agent-workflow', null));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [agentCatalog, setAgentCatalog] = useState({ agents: [], skills: [] });
  const [results, setResults] = useState(() => readSavedState('co-agent:agent-results', {}));
  const [activeResult, setActiveResult] = useState('');
  const [commands, setCommands] = useState([]);
  const [commandId, setCommandId] = useState('npm-test');
  const [terminalLog, setTerminalLog] = useState([]);
  const [terminalStatus, setTerminalStatus] = useState('idle');
  const [terminalResult, setTerminalResult] = useState(null);
  const [contextSearch, setContextSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showAllAgents, setShowAllAgents] = useState(false);
  const terminalReceivedOutput = useRef(false);

  const refreshFiles = useCallback(async () => {
    if (!desktop?.workspace) return;
    try {
      const [rootResult, listing] = await Promise.all([desktop.workspace.getRoot(), desktop.workspace.listFiles({ maxFiles: 500 })]);
      setWorkspaceRoot(rootResult?.root || '');
      if (listing?.ok) { setFiles(listing.files || []); setFilesTruncated(Boolean(listing.truncated)); }
      else if (listing?.error) setNotice(listing.error);
    } catch (error) { setNotice(errorText(error)); }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        const [runtime, catalog, commandList, rootResult, repoResult] = await Promise.all([
          desktop?.runtime?.ollamaStatus?.(),
          desktop?.agents?.list?.(),
          desktop?.terminal?.listCommands?.(),
          desktop?.workspace?.getRoot?.(),
          desktop?.integrations?.listRepos?.()
        ]);
        setModels(runtime?.models || []);
        setModel(runtime?.models?.[0]?.name || runtime?.models?.[0]?.model || '');
        setAgentCatalog({ agents: catalog?.agents || [], skills: catalog?.skills || [] });
        setCommands(commandList?.commands || []);
        setImportedRepos(Array.isArray(repoResult) ? repoResult.filter(item => item.hasSkill) : []);
        setWorkspaceRoot(rootResult?.root || '');
        if (rootResult?.root) await refreshFiles();
      } catch (error) { setNotice(errorText(error)); }
    })();
    if (desktop?.terminal?.onOutput) unsubscribe = desktop.terminal.onOutput(event => {
      terminalReceivedOutput.current = true;
      setTerminalLog(old => [...old, { stream: event.stream || 'stdout', text: event.text || '' }].slice(-800));
      setTerminalStatus('running');
    });
    return () => unsubscribe();
  }, [refreshFiles]);

  useEffect(() => {
    try {
      window.localStorage.setItem('co-agent:agent-goal', JSON.stringify(goal));
      window.localStorage.setItem('co-agent:agent-workflow', JSON.stringify(workflow));
      window.localStorage.setItem('co-agent:agent-results', JSON.stringify(results));
      window.localStorage.setItem('co-agent:agent-context-paths', JSON.stringify(selectedPaths));
      window.localStorage.setItem('co-agent:agent-external-skills', JSON.stringify(selectedExternalSkills));
    } catch {}
  }, [goal, workflow, results, selectedPaths, selectedExternalSkills]);

  const pipeline = workflow?.pipeline || [];
  const doneCount = useMemo(() => pipeline.filter(step => step.status === 'done').length, [pipeline]);
  const runningCount = useMemo(() => pipeline.filter(step => step.status === 'running').length, [pipeline]);
  const filteredFiles = useMemo(() => files.filter(file => file.path.toLowerCase().includes(contextSearch.trim().toLowerCase())), [files, contextSearch]);
  const filteredAgents = useMemo(() => agentCatalog.agents.filter(agent => (agent.name + ' ' + agent.purpose).toLowerCase().includes(catalogSearch.trim().toLowerCase())), [agentCatalog.agents, catalogSearch]);
  const filteredSkills = useMemo(() => agentCatalog.skills.filter(skill => (skill.name + ' ' + skill.category + ' ' + skill.description).toLowerCase().includes(catalogSearch.trim().toLowerCase())), [agentCatalog.skills, catalogSearch]);
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
      if (listing?.ok) { setFiles(listing.files || []); setFilesTruncated(Boolean(listing.truncated)); }
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

  const toggleCriterion = (stepId, index, checked) => {
    setResults(old => ({ ...old, [stepId]: { ...old[stepId], reviewChecks: checked ? [...new Set([...(old[stepId]?.reviewChecks || []), index])] : (old[stepId]?.reviewChecks || []).filter(item => item !== index) } }));
  };

  const confirmCheckpoint = stepId => {
    const step = workflow?.pipeline?.find(item => item.id === stepId);
    if (!step || step.status !== 'review') return;
    const checks = results[stepId]?.reviewChecks || [];
    const criteria = step.acceptanceCriteria || [];
    if (criteria.some((_, index) => !checks.includes(index))) { setNotice('Review and check every acceptance criterion before unlocking the next step.'); return; }
    setWorkflow(old => ({ ...old, pipeline: old.pipeline.map(item => item.id === stepId ? { ...item, status: 'done' } : item) }));
    setNotice('Checkpoint confirmed for “' + step.title + '”. Dependent steps are now unlocked.');
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
      let externalSkills = [];
      if (selectedExternalSkills.length && desktop?.integrations?.getSkills) {
        const loadedSkills = await desktop.integrations.getSkills(selectedExternalSkills);
        if (loadedSkills?.ok === false || loadedSkills?.error) throw new Error(loadedSkills.error || 'Could not load selected repository skills.');
        externalSkills = Array.isArray(loadedSkills) ? loadedSkills : [];
      }
      const result = await desktop.agents.runStep({ goal: workflow.goal, step, priorResults, contextFiles, externalSkills, model });
      if (result?.ok === false || result?.error) throw new Error(result.error || 'Agent step failed.');
      if (result.files?.length) {
        result.files = await Promise.all(result.files.map(async file => {
          const current = workspaceRoot ? await desktop.workspace.readFile(file.path) : { ok: false, error: 'No workspace selected.' };
          const isNew = !current?.ok && /ENOENT|no such file/i.test(current?.error || '');
          return { ...file, originalContent: current?.ok ? current.content : '', isNew, originalUnavailable: !current?.ok && !isNew };
        }));
      }
      setResults(old => ({ ...old, [step.id]: { ...result, reviewChecks: [] } }));
      setActiveResult(step.id);
      setWorkflow(old => ({ ...old, pipeline: old.pipeline.map(item => item.id === step.id ? { ...item, status: 'review', result: result.summary } : item) }));
      setNotice(step.title + ' produced a result. Review the output and check every acceptance criterion before the next dependent step can run. ' + (result.files?.length ? result.files.length + ' file proposal(s) await your review.' : 'No files were changed.'));
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
    setBusy('terminal'); setTerminalStatus('running'); setTerminalResult(null); setTerminalLog([]); terminalReceivedOutput.current = false;
    setNotice('A native confirmation will appear before the command runs.');
    try {
      const result = await desktop.terminal.runCommand(commandId);
      if (result?.ok === false && result?.error) throw new Error(result.error);
      setTerminalResult(result);
      setTerminalStatus(result?.ok ? 'success' : 'failed');
      if (result?.output && !terminalReceivedOutput.current) setTerminalLog([{ stream: 'stdout', text: result.output }]);
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
      <div><p className="eyebrow"><span className="agents-live-dot"/> YOUR AI ENGINEERING STUDIO</p><h1>Build with <span className="agents-heading-dot">CO-Agent.</span></h1><p className="subhead">Turn a goal into a reviewable workflow. Coordinate local AI specialists, inspect every proposed change, and verify real project builds.</p></div>
      <div className="agents-heading-mark"><BrainCircuit size={26}/><span>Local-first harness</span></div>
    </div>

    <div className="agents-metrics" aria-label="Workspace overview">
      <div className="agents-metric"><span className="agents-metric-icon"><Layers size={16}/></span><div><strong>{pipeline.length}</strong><small>Workflow steps</small></div></div>
      <div className="agents-metric"><span className="agents-metric-icon good"><CheckCircle2 size={16}/></span><div><strong>{doneCount}</strong><small>Completed</small></div></div>
      <div className="agents-metric"><span className={'agents-metric-icon ' + (runningCount ? 'active' : '')}><Activity size={16}/></span><div><strong>{runningCount}</strong><small>Running now</small></div></div>
      <div className="agents-metric"><span className="agents-metric-icon"><Gauge size={16}/></span><div><strong>{agentCatalog.agents.length}</strong><small>Specialists</small></div></div>
      <div className="agents-metrics-tail"><span className="agents-live-dot"/> {workspaceRoot ? 'Workspace connected' : 'Choose a workspace to begin'}</div>
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
          <div className="agents-card-heading"><span className="agents-icon"><Sparkles size={17}/></span><div><h2>What are we building today?</h2><p>Start with a task or use a focused brief. The planner turns it into reviewable steps.</p></div><span className="agents-step-chip">PLAN · BUILD · VERIFY</span></div>
          <div className="agents-prompt-chips" aria-label="Task starters">
            <button type="button" onClick={() => setGoal('Inspect this project for bugs, reproduce likely failures, fix the root causes, and run relevant tests.')}> <ShieldCheck size={13}/> Find &amp; fix bugs</button>
            <button type="button" onClick={() => setGoal('Audit the current interface and improve usability, accessibility, responsiveness, and visual consistency without breaking existing behavior.')}> <Sparkles size={13}/> Upgrade UI/UX</button>
            <button type="button" onClick={() => setGoal('Profile the main code paths, identify measurable performance bottlenecks, make safe improvements, and run regression tests.')}> <Activity size={13}/> Improve performance</button>
          </div>
          <textarea value={goal} onChange={event => setGoal(event.target.value)} placeholder="Describe the outcome you want… Be specific about what ‘done’ looks like." rows={5} maxLength={5000} aria-label="Task brief" />
          <div className="agents-prompt-foot"><span>{goal.length.toLocaleString()} / 5,000 characters</span><button type="button" className="text-link" disabled={!goal} onClick={() => setGoal('')}>Clear brief</button></div>
          <div className="agents-plan-controls"><label><span className="agents-field-label">Planning model</span><select value={model} onChange={event => setModel(event.target.value)}><option value="">Choose model</option>{models.map(item => <option key={item.name || item.model} value={item.name || item.model}>{item.name || item.model}</option>)}</select></label><button className="primary-button agents-create-button" disabled={!goal.trim() || !!busy || !model}><Sparkles size={14}/>{busy === 'plan' ? 'Planning workflow…' : 'Create workflow'}<span aria-hidden="true">→</span></button></div>
          {!models.length && <p className="agents-inline-warning">Ollama is not available or no models are installed. Connect Ollama and choose a model in Models & settings.</p>}
        </form>

        {workflow ? <div className="agents-pipeline-card">
          <div className="agents-pipeline-title"><div><p className="eyebrow">ACTIVE WORKFLOW</p><h2>{workflow.title}</h2><p>{workflow.goal}</p></div><span className="agents-progress">{doneCount}/{workflow.pipeline.length} confirmed</span></div>
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
                {step.status === 'review' && result && <div className="agents-checkpoint"><strong><ShieldCheck size={14}/> Review checkpoint</strong>{step.acceptanceCriteria?.length ? <ul>{step.acceptanceCriteria.map((criterion, criterionIndex) => <li key={criterionIndex}><label><input type="checkbox" checked={(result.reviewChecks || []).includes(criterionIndex)} onChange={event => toggleCriterion(step.id, criterionIndex, event.target.checked)}/><span>{criterion}</span></label></li>)}</ul> : <p>Review the summary, findings, risks, and any proposed changes before confirming this step.</p>}<button className="primary-button" disabled={!!busy || (step.acceptanceCriteria || []).some((_, criterionIndex) => !(result.reviewChecks || []).includes(criterionIndex))} onClick={() => confirmCheckpoint(step.id)}><ShieldCheck size={13}/> Confirm checkpoint &amp; unlock next step</button></div>}
                <div className="agents-step-actions">
                  <button className="secondary-button" disabled={!!busy || step.status === 'running' || blockedBy.length > 0 || (activeRun?.goal === workflow.goal && activeRun.steps.find(saved => saved.id === step.id)?.status === 'completed')} onClick={() => runStep(step)}><Play size={13}/>{busy === step.id ? 'Running…' : step.status === 'done' ? 'Run again' : 'Run agent step'}</button>
                  {result && <button className="text-link" onClick={() => setActiveResult(activeResult === step.id ? '' : step.id)}>{activeResult === step.id ? 'Hide result' : 'View result'}</button>}
                  {blockedBy.length > 0 && <small>Finish dependencies first</small>}
                </div>
                {activeResult === step.id && result && <div className="agents-result">
                  <div className="agents-result-summary"><strong>{result.role} · {result.skill}</strong><span>{result.model}</span></div>
                  <p>{result.summary}</p>
                  {result.findings?.length > 0 && <><h4>Findings</h4><ul>{result.findings.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
                  {result.risks?.length > 0 && <><h4>Risks to review</h4><ul className="agents-risk-list">{result.risks.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
                  {result.needsUserInput && <p className="agents-inline-warning">Agent asks: {result.userQuestion || 'Please clarify the task.'}</p>}
                  {result.files?.length > 0 && <div className="agents-file-proposals"><h4><FileCode2 size={14}/> Proposed file changes ({result.files.length})</h4>{result.files.map(file => <details key={file.path}><summary>{file.path} <span>{file.isNew ? 'NEW FILE' : file.originalUnavailable ? 'CURRENT CONTENT UNAVAILABLE' : 'MODIFIED'} · {file.content.length.toLocaleString()} chars proposed</span></summary><div className="agents-file-comparison"><div><strong>Current file</strong><pre>{file.isNew ? '(New file — nothing to replace)' : file.originalUnavailable ? '(Could not read current file; inspect carefully before applying)' : file.originalContent}</pre></div><div><strong>Proposed file</strong><pre>{file.content}</pre></div></div></details>)}<button className="primary-button" onClick={() => applyProposals(step.id)} disabled={!!busy}><ShieldCheck size={14}/> Review and apply files</button></div>}
                  {result.applied?.length > 0 && <div className="agents-applied"><CheckCircle2 size={14}/> Applied {result.applied.length} file(s); backup folder created.</div>}
                  {result.suggestedCommands?.length > 0 && <div className="agents-suggested-commands"><strong>Suggested terminal checks</strong>{result.suggestedCommands.map(id => {const cmd=commands.find(item => item.id === id);return cmd ? <button key={id} onClick={() => {setCommandId(id);setNotice('Selected terminal command: '+cmd.label);}}>{cmd.label}</button> : null})}</div>}
                </div>}
              </div>
            </article>;
          })}</div>
          <div className="agents-pipeline-footer"><span><CheckCircle2 size={14}/>{doneCount} of {workflow.pipeline.length} checkpoints confirmed</span><button className="text-link" onClick={() => {setWorkflow(null);setResults({});setActiveResult('');}}>Clear workflow</button></div>
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
        <div className="agents-side-card"><div className="agents-side-heading"><BrainCircuit size={16}/><h2>Agent team</h2><span>{agentCatalog.agents.length}</span></div><p>Specialists share completed context but cannot silently run tools. Search to find the right capability.</p><label className="agents-search"><Sparkles size={13}/><input value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} placeholder="Search agents and skills…" aria-label="Search agents and skills"/>{catalogSearch && <button type="button" onClick={() => setCatalogSearch("")} aria-label="Clear search"><XCircle size={13}/></button>}</label>{filteredAgents.slice(0,showAllAgents ? filteredAgents.length : 5).map(agent => <div className="agents-catalog-row" key={agent.id}><span className="agents-catalog-avatar"><Bot size={14}/></span><div><strong>{agent.name}</strong><small>{agent.purpose}</small></div></div>)}{filteredAgents.length > 5 && <button className="text-link agents-show-more" onClick={() => setShowAllAgents(old => !old)}>{showAllAgents ? "Show fewer specialists" : "Show all " + filteredAgents.length + " specialists"}</button>}{!filteredAgents.length && <p className="agents-no-results">No matching specialists.</p>}</div>
        {importedRepos.length > 0 && <div className="agents-side-card"><div className="agents-side-heading"><GitBranch size={16}/><h2>Imported skills</h2><span>{selectedExternalSkills.length}</span></div><p>Optional SKILL.md notes from imported public repositories. They are untrusted hints, not executable plugins.</p>{importedRepos.map(repo => <label className="agents-external-skill" key={repo.slug}><input type="checkbox" checked={selectedExternalSkills.includes(repo.slug)} disabled={!selectedExternalSkills.includes(repo.slug) && selectedExternalSkills.length >= 4} onChange={event => setSelectedExternalSkills(old => event.target.checked ? [...old, repo.slug] : old.filter(slug => slug !== repo.slug))}/><span><strong>{repo.name}</strong><small>{repo.description || repo.url}</small></span></label>)}<button className="text-link" onClick={() => { window.localStorage.setItem('co-agent:agent-external-skills', JSON.stringify(selectedExternalSkills)); setNotice('Selected imported skills are used only as untrusted context on the next agent step.'); }}>Save skill selection</button></div>}
        <div className="agents-side-card"><div className="agents-side-heading"><Wrench size={16}/><h2>Built-in skills</h2><span>{agentCatalog.skills.length}</span></div><p>Reusable quality harnesses are injected into specialist prompts based on the assigned task.</p>{filteredSkills.map(skill => <details className="agents-skill-row" key={skill.id}><summary><span>{skill.name}</span><small>{skill.category}</small></summary><p>{skill.description}</p></details>)}{!filteredSkills.length && <p className="agents-no-results">No skills match this search.</p>}</div>
        <div className="agents-side-card"><div className="agents-side-heading"><ShieldCheck size={16}/><h2>Harness guardrails</h2></div><ul className="agents-guardrail-list"><li>Separate planning, implementation, review, and testing roles.</li><li>Dependencies prevent steps from running out of order.</li><li>File proposals are previewed before applying.</li><li>Existing files receive backups under .co-agent-backups.</li><li>Terminal commands use fixed presets and native confirmation.</li><li>Command output, exit code, timeout, and errors are visible.</li><li>Secrets, symlinks, and protected folders are blocked from file tools.</li></ul></div>
        {workspaceRoot && <div className="agents-side-card"><div className="agents-side-heading"><FileCode2 size={16}/><h2>Context files</h2><span>{selectedPaths.length}/8</span></div><p>Select files for agents to inspect. Only checked files are sent to the local model.</p><label className="agents-search agents-context-search"><FolderOpen size={13}/><input value={contextSearch} onChange={event => setContextSearch(event.target.value)} placeholder="Filter workspace files…" aria-label="Filter workspace files"/>{contextSearch && <button type="button" onClick={() => setContextSearch("")} aria-label="Clear file filter"><XCircle size={13}/></button>}</label><div className="agents-file-count">Showing {filteredFiles.length} of {files.length} files · {selectedPaths.length}/8 selected{filesTruncated ? ' · list capped at 500 files' : ''}</div><div className="agents-file-list">{filteredFiles.map(file => { const selected = selectedPaths.includes(file.path); const tooLarge = file.size > 30 * 1024; return <label key={file.path} title={tooLarge ? file.path + ' — exceeds the 30 KB per-file agent context limit' : file.path}><input type="checkbox" checked={selected} disabled={(!selected && (selectedPaths.length >= 8 || tooLarge))} onChange={event => setSelectedPaths(old => event.target.checked ? [...old, file.path] : old.filter(item => item !== file.path))}/><span>{file.path}</span><small>{tooLarge ? 'Too large' : file.size > 1024 ? Math.round(file.size / 1024) + ' KB' : file.size + ' B'}</small></label>; })}{!filteredFiles.length && <p className="agents-no-results">No files match this filter.</p>}</div><small className="agents-context-note">Files over 30 KB are excluded because the agent context limit is 30 KB per file. Sensitive filenames, dependencies, build output, and symlink entries are filtered by the workspace layer.</small></div>}
      </aside>
    </div>
    {notice && <p className="inline-notice agents-notice" role="status">{notice}</p>}
  </section>;
}
