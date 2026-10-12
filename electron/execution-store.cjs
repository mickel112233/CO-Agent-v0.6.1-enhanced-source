'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_RUNS = 50;
const MAX_STEPS = 7;
const MAX_EVENTS = 300;
const MAX_RESULT_CHARS = 6000;
const RUN_STATUSES = new Set(['ready', 'running', 'paused', 'completed', 'failed', 'cancelled']);
const STEP_STATUSES = new Set(['queued', 'running', 'awaiting-approval', 'completed', 'failed', 'cancelled']);

function cleanText(value, max, fallback = '') {
  return String(value ?? fallback).replace(/[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]/g, '').slice(0, max);
}
function normalizeSteps(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_STEPS) throw new Error('A run must contain between 1 and ' + MAX_STEPS + ' steps.');
  const ids = new Set();
  return input.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error('Run step ' + (index + 1) + ' is invalid.');
    const id = cleanText(step.id || ('step-' + (index + 1)), 100);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || ids.has(id)) throw new Error('Run step IDs must be unique and use letters, numbers, underscores, or hyphens.');
    ids.add(id);
    if (step.dependsOn != null && !Array.isArray(step.dependsOn)) throw new Error('Step dependencies must be an array.');
    const dependsOn = [...new Set((step.dependsOn || []).map(String))];
    if (dependsOn.length > MAX_STEPS || dependsOn.some(dep => !/^[A-Za-z0-9_-]{1,100}$/.test(dep))) throw new Error('Step dependencies are invalid.');
    return {
      id, title: cleanText(step.title || ('Step ' + (index + 1)), 120),
      role: cleanText(step.role || 'implementer', 60), skill: cleanText(step.skill || '', 100),
      description: cleanText(step.description || '', 2000),
      deliverable: cleanText(step.deliverable || '', 600),
      acceptanceCriteria: Array.isArray(step.acceptanceCriteria) ? step.acceptanceCriteria.slice(0, 8).map(item => cleanText(item, 300)) : [],
      dependsOn, status: 'queued', attempts: 0, result: '', error: '', updatedAt: null
    };
  }).map((step, index, all) => {
    if (step.dependsOn.includes(step.id)) throw new Error('A step cannot depend on itself.');
    const known = new Set(all.map(item => item.id));
    if (step.dependsOn.some(dep => !known.has(dep))) throw new Error('A step references an unknown dependency.');
    if (step.dependsOn.some(dep => all.findIndex(item => item.id === dep) >= index)) throw new Error('Dependencies must point to earlier steps to prevent cycles.');
    return step;
  });
}
function validateStore(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.runs)) throw new Error('Execution history has an unsupported or invalid format.');
  const seen = new Set();
  const runs = raw.runs.slice(0, MAX_RUNS).map(run => {
    if (!run || !/^[A-Za-z0-9_-]{1,100}$/.test(String(run.id || '')) || seen.has(run.id)) throw new Error('Execution history contains an invalid or duplicate run ID.');
    seen.add(run.id);
    if (!RUN_STATUSES.has(run.status)) throw new Error('Execution history contains an unsupported run status.');
    const steps = normalizeSteps(run.steps);
    if (steps.length !== run.steps.length) throw new Error('Execution history contains invalid steps.');
    run.steps.forEach((step, index) => {
      if (!STEP_STATUSES.has(step.status)) throw new Error('Execution history contains an unsupported step status.');
      steps[index] = { ...steps[index], status: step.status, attempts: Math.max(0, Math.min(3, Number(step.attempts) || 0)), result: cleanText(step.result, MAX_RESULT_CHARS), error: cleanText(step.error, 1200), updatedAt: step.updatedAt || null };
    });
    return {
      id: run.id, title: cleanText(run.title || 'Workflow run', 120), goal: cleanText(run.goal, 5000),
      status: run.status, approvedAt: run.approvedAt, createdAt: run.createdAt, updatedAt: run.updatedAt,
      currentStepId: run.currentStepId || null, steps,
      events: Array.isArray(run.events) ? run.events.slice(-MAX_EVENTS).map(event => ({ at: event.at, type: cleanText(event.type, 60), stepId: event.stepId || null, message: cleanText(event.message, 800) })) : []
    };
  });
  return { version: 1, runs };
}
function createStore(filePath, options = {}) {
  const file = path.resolve(String(filePath || ''));
  const io = options.fs || fs;
  const now = options.now || (() => new Date().toISOString());
  let queue = Promise.resolve();
  async function read() {
    try {
      const stat = await io.stat(file);
      if (stat.size > 4 * 1024 * 1024) throw new Error('Execution history exceeds the 4 MB safety limit.');
      return validateStore(JSON.parse(await io.readFile(file, 'utf8')));
    } catch (error) {
      if (error?.code === 'ENOENT') return { version: 1, runs: [] };
      throw new Error('Execution history could not be read safely: ' + (error.message || String(error)));
    }
  }
  async function write(data) {
    const safe = validateStore(data);
    await io.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(6).toString('hex');
    try {
      await io.writeFile(temp, JSON.stringify(safe), { encoding: 'utf8', mode: 0o600 });
      await io.rename(temp, file);
    } finally { await io.rm(temp, { force: true }).catch(() => {}); }
    return safe;
  }
  function mutate(fn) {
    const operation = queue.catch(() => {}).then(async () => {
      const data = await read();
      const result = await fn(data);
      await write(data);
      return result;
    });
    queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
  function event(run, type, message, stepId = null) {
    run.events.push({ at: now(), type, message: cleanText(message, 800), stepId });
    run.events = run.events.slice(-MAX_EVENTS);
    run.updatedAt = now();
  }
  return Object.freeze({
    list: async () => (await read()).runs,
    create: async payload => {
      if (payload?.approved !== true) throw new Error('Review and explicitly approve the plan before creating an executable run.');
      const goal = cleanText(payload.goal, 5000).trim();
      if (goal.length < 8) throw new Error('Run goal must contain at least 8 characters.');
      const steps = normalizeSteps(payload.steps);
      return mutate(data => {
        const run = { id: crypto.randomUUID().replace(/-/g, ''), title: cleanText(payload.title || 'Workflow run', 120), goal, status: 'ready', approvedAt: now(), createdAt: now(), updatedAt: now(), currentStepId: null, steps, events: [] };
        event(run, 'approved', 'User approved the workflow plan; steps will not run until explicitly started.');
        data.runs.unshift(run);
        data.runs = data.runs.slice(0, MAX_RUNS);
        return run;
      });
    },
    get: async id => (await read()).runs.find(run => run.id === String(id)) || null,
    updateStep: (id, stepId, action, payload = {}) => mutate(data => {
      const run = data.runs.find(item => item.id === String(id));
      if (!run) throw new Error('Workflow run was not found.');
      if (run.status === 'cancelled' || run.status === 'completed') throw new Error('This workflow run is already ' + run.status + '.');
      const step = run.steps.find(item => item.id === String(stepId));
      if (!step) throw new Error('Workflow step was not found.');
      const at = now();
      if (action === 'start') {
        if (run.status === 'paused') throw new Error('Resume the workflow before starting another step.');
        if (!['queued', 'failed'].includes(step.status)) throw new Error('Only queued or failed steps can be started.');
        if (step.attempts >= 3) throw new Error('This step reached the retry limit of 3 attempts.');
        if (step.dependsOn.some(dep => run.steps.find(item => item.id === dep)?.status !== 'completed')) throw new Error('Complete all prerequisite steps before starting this step.');
        step.status = 'running'; step.attempts += 1; step.error = ''; run.status = 'running'; run.currentStepId = step.id;
        event(run, 'step-started', 'Step started (attempt ' + step.attempts + ' of 3).', step.id);
      } else if (action === 'awaiting-approval') {
        if (step.status !== 'running') throw new Error('Only a running step can request approval.');
        step.status = 'awaiting-approval'; event(run, 'approval-needed', cleanText(payload.message || 'This step needs your review.', 800), step.id);
      } else if (action === 'complete') {
        if (step.status !== 'running' && step.status !== 'awaiting-approval') throw new Error('Only a running or approved step can be completed.');
        if (step.status === 'awaiting-approval' && payload.approved !== true) throw new Error('Explicit user approval is required to complete this gated step.');
        step.status = 'completed'; step.result = cleanText(payload.result, MAX_RESULT_CHARS); step.error = '';
        event(run, 'step-completed', cleanText(payload.message || 'Step marked complete; verify the deliverable before continuing.', 800), step.id);
        if (run.steps.every(item => item.status === 'completed')) { run.status = 'completed'; run.currentStepId = null; event(run, 'run-completed', 'All workflow steps are marked complete.'); }
        else { run.status = 'ready'; run.currentStepId = null; }
      } else if (action === 'fail') {
        if (step.status !== 'running' && step.status !== 'awaiting-approval') throw new Error('Only an active step can fail.');
        step.status = 'failed'; step.error = cleanText(payload.error || 'Step failed.', 1200); run.status = 'failed'; run.currentStepId = null;
        event(run, 'step-failed', step.error, step.id);
      } else if (action === 'cancel-step') {
        if (!['running', 'awaiting-approval', 'queued', 'failed'].includes(step.status)) throw new Error('This step cannot be cancelled from its current state.');
        step.status = 'cancelled'; run.status = 'ready'; run.currentStepId = null; event(run, 'step-cancelled', 'Step cancelled by the user.', step.id);
      } else throw new Error('Unsupported step transition.');
      step.updatedAt = at;
      return run;
    }),
    pause: id => mutate(data => {
      const run = data.runs.find(item => item.id === String(id));
      if (!run) throw new Error('Workflow run was not found.');
      if (run.status !== 'running' && run.status !== 'ready') throw new Error('Only a ready or running workflow can be paused.');
      run.status = 'paused'; event(run, 'run-paused', 'Workflow paused by the user.'); return run;
    }),
    resume: id => mutate(data => {
      const run = data.runs.find(item => item.id === String(id));
      if (!run) throw new Error('Workflow run was not found.');
      if (run.status !== 'paused') throw new Error('Only a paused workflow can be resumed.');
      run.status = 'ready'; event(run, 'run-resumed', 'Workflow resumed; each step still requires explicit start.'); return run;
    }),
    cancel: id => mutate(data => {
      const run = data.runs.find(item => item.id === String(id));
      if (!run) throw new Error('Workflow run was not found.');
      if (['completed', 'cancelled'].includes(run.status)) return run;
      run.status = 'cancelled'; run.currentStepId = null;
      for (const step of run.steps) if (['queued', 'running', 'awaiting-approval'].includes(step.status)) step.status = 'cancelled';
      event(run, 'run-cancelled', 'Workflow cancelled by the user.'); return run;
    })
  });
}
module.exports = { createStore, normalizeSteps, validateStore, MAX_RUNS, MAX_STEPS, MAX_EVENTS };
