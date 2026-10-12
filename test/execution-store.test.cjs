'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createStore, validateStore } = require('../electron/execution-store.cjs');

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-runs-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return { file: path.join(dir, 'runs.json'), dir };
}
const plan = () => ({ approved: true, title: 'Release workflow', goal: 'Build and verify a release', steps: [
  { id: 'inspect', title: 'Inspect', role: 'reviewer' },
  { id: 'build', title: 'Build', role: 'implementer', dependsOn: ['inspect'] }
] });

test('run creation requires explicit approval and persists across store instances', async t => {
  const { file } = await fixture(t);
  const store = createStore(file);
  await assert.rejects(store.create({ ...plan(), approved: false }), /explicitly approve/i);
  const created = await store.create(plan());
  assert.equal(created.status, 'ready');
  assert.equal((await createStore(file).get(created.id)).goal, 'Build and verify a release');
  assert.equal((await createStore(file).list()).length, 1);
});

test('step execution is gated by dependencies and transitions are validated', async t => {
  const { file } = await fixture(t);
  const store = createStore(file);
  const run = await store.create(plan());
  await assert.rejects(store.updateStep(run.id, 'build', 'start'), /prerequisite/i);
  await assert.rejects(store.updateStep(run.id, 'inspect', 'complete', { result: 'No start' }), /running/i);
  await store.updateStep(run.id, 'inspect', 'start');
  await store.updateStep(run.id, 'inspect', 'complete', { result: 'Inspection passed' });
  await store.updateStep(run.id, 'build', 'start');
  const done = await store.updateStep(run.id, 'build', 'complete', { result: 'Build verified' });
  assert.equal(done.status, 'completed');
  assert.deepEqual(done.steps.map(step => step.status), ['completed', 'completed']);
  assert.ok(done.events.some(event => event.type === 'run-completed'));
});

test('failure can be retried only within bounded attempts', async t => {
  const { file } = await fixture(t);
  const store = createStore(file);
  const run = await store.create({ ...plan(), steps: [{ id: 'one', title: 'One' }] });
  for (let attempt = 1; attempt <= 3; attempt++) {
    await store.updateStep(run.id, 'one', 'start');
    await store.updateStep(run.id, 'one', 'fail', { error: 'transient' });
  }
  await assert.rejects(store.updateStep(run.id, 'one', 'start'), /retry limit/i);
});

test('pause, resume, approval checkpoint, and cancellation are durable', async t => {
  const { file } = await fixture(t);
  const store = createStore(file);
  const run = await store.create({ ...plan(), steps: [{ id: 'one', title: 'One' }, { id: 'two', title: 'Two', dependsOn: ['one'] }] });
  await store.updateStep(run.id, 'one', 'start');
  await store.updateStep(run.id, 'one', 'awaiting-approval', { message: 'Review proposed change' });
  await assert.rejects(store.updateStep(run.id, 'one', 'complete', { result: 'done' }), /explicit user approval/i);
  await store.updateStep(run.id, 'one', 'complete', { approved: true, result: 'reviewed' });
  await store.updateStep(run.id, 'two', 'start');
  await store.pause(run.id);
  await store.resume(run.id);
  assert.equal((await createStore(file).get(run.id)).steps[0].result, 'reviewed');
  const cancelled = await store.cancel(run.id);
  assert.equal(cancelled.status, 'cancelled');
  await assert.rejects(store.updateStep(run.id, 'one', 'start'), /already cancelled/i);
});

test('rejects malformed histories and cyclic/unknown dependencies', async t => {
  assert.throws(() => validateStore({ version: 1, runs: [{ id: 'x', status: 'bogus', steps: [] }] }), /unsupported.*status/i);
  const { file } = await fixture(t);
  const store = createStore(file);
  await assert.rejects(store.create({ ...plan(), steps: [{ id: 'one', dependsOn: ['missing'] }] }), /unknown dependency/i);
  await assert.rejects(store.create({ ...plan(), steps: [{ id: 'one', dependsOn: ['two'] }, { id: 'two' }] }), /earlier step/i);
});


test('startup recovery marks unreviewed output failed so users can regenerate it safely', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-recovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'workflow-runs.json');
  const first = createStore(file);
  const run = await first.create({ approved: true, title: 'Recover review', goal: 'Review a result', steps: [{ id: 'step-1', title: 'Draft', role: 'planner', skill: 'planning', description: 'Draft output' }] });
  await first.updateStep(run.id, 'step-1', 'start');
  await first.updateStep(run.id, 'step-1', 'awaiting-approval', { result: 'Output waiting for review.' });
  const recovered = await createStore(file).list();
  assert.equal(recovered[0].status, 'failed');
  assert.equal(recovered[0].steps[0].status, 'failed');
  assert.match(recovered[0].steps[0].error, /re-run the step to regenerate/i);
  assert.ok(recovered[0].events.some(event => event.type === 'run-recovered'));
});


test('startup recovery retries if persisting recovery state fails once', async t => {
  const { file } = await fixture(t);
  const initial = createStore(file);
  const run = await initial.create({ ...plan(), steps: [{ id: 'one', title: 'One' }] });
  await initial.updateStep(run.id, 'one', 'start');
  let failOnce = true;
  const flakyFs = {
    stat: (...args) => fs.stat(...args),
    readFile: (...args) => fs.readFile(...args),
    mkdir: (...args) => fs.mkdir(...args),
    rename: (...args) => fs.rename(...args),
    rm: (...args) => fs.rm(...args),
    writeFile: (...args) => {
      if (failOnce) { failOnce = false; const error = new Error('simulated disk full'); error.code = 'ENOSPC'; return Promise.reject(error); }
      return fs.writeFile(...args);
    }
  };
  const recovering = createStore(file, { fs: flakyFs });
  await assert.rejects(recovering.list(), /could not be read safely|disk full/i);
  const recovered = await recovering.list();
  assert.equal(recovered[0].status, 'failed');
  assert.equal(recovered[0].steps[0].status, 'failed');
  assert.ok(recovered[0].events.some(event => event.type === 'run-recovered'));
});


test('completion requires a non-empty result and every declared acceptance criterion', async t => {
  const { file } = await fixture(t);
  const store = createStore(file);
  const run = await store.create({ ...plan(), steps: [{
    id: 'verify', title: 'Verify', acceptanceCriteria: ['Build passes', 'Smoke test passes']
  }] });
  await store.updateStep(run.id, 'verify', 'start');
  await assert.rejects(store.updateStep(run.id, 'verify', 'complete', { result: 'ok' }), /every acceptance criterion/i);
  await assert.rejects(store.updateStep(run.id, 'verify', 'complete', { acceptanceChecks: [0, 1], result: '   ' }), /recorded result/i);
  await assert.rejects(store.updateStep(run.id, 'verify', 'complete', { acceptanceChecks: [0, 0], result: 'ok' }), /every acceptance criterion/i);
  const completed = await store.updateStep(run.id, 'verify', 'complete', {
    acceptanceChecks: [0, 1], result: 'Build passed; smoke test passed.'
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.steps[0].status, 'completed');
});
