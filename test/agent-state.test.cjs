'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('recovery marks interrupted steps blocked and never auto-replays them', async () => {
  const { recoverInterruptedWorkflow } = await import('../src/agent-state.mjs');
  const source = {
    title: 'Test workflow',
    pipeline: [
      { id: 'done-step', status: 'done', result: 'verified output' },
      { id: 'running-step', status: 'running', result: 'partial output' },
      { id: 'queued-step', status: 'queued' }
    ]
  };
  const recovery = recoverInterruptedWorkflow(source);
  assert.deepEqual(recovery.interruptedIds, ['running-step']);
  assert.equal(recovery.workflow.pipeline[0].status, 'done');
  assert.equal(recovery.workflow.pipeline[1].status, 'blocked');
  assert.match(recovery.workflow.pipeline[1].result, /rerun it manually/i);
  assert.equal(recovery.workflow.pipeline[2].status, 'queued');
  assert.match(recovery.message, /never replayed automatically|no work was replayed automatically/i);
  assert.equal(source.pipeline[1].status, 'running', 'saved input object must not be mutated');
});

test('recovery leaves workflows with no running steps unchanged', async () => {
  const { recoverInterruptedWorkflow } = await import('../src/agent-state.mjs');
  const workflow = { pipeline: [{ id: 'one', status: 'done' }, { id: 'two', status: 'queued' }] };
  const recovery = recoverInterruptedWorkflow(workflow);
  assert.deepEqual(recovery.interruptedIds, []);
  assert.equal(recovery.workflow, workflow);
  assert.equal(recovery.message, '');
});

test('recovery handles missing or malformed persisted workflow data', async () => {
  const { recoverInterruptedWorkflow } = await import('../src/agent-state.mjs');
  assert.deepEqual(recoverInterruptedWorkflow(null), { workflow: null, interruptedIds: [], message: '' });
  assert.deepEqual(recoverInterruptedWorkflow({ pipeline: 'invalid' }), { workflow: { pipeline: 'invalid' }, interruptedIds: [], message: '' });
});
