const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePlanActions, assertApproved } = require('../electron/computer-use.cjs');

test('computer-use planner accepts only bounded, supported actions', () => {
  const actions = validatePlanActions({
    actions: [
      { type: 'click', x: 0, y: 49, reason: 'Visible button' },
      { type: 'type', text: 'hello world', reason: 'Search query' },
      { type: 'key', key: 'ENTER', reason: 'Confirm search' }
    ]
  }, 100, 50);
  assert.deepEqual(actions.map(action => action.type), ['click', 'type', 'key']);
  assert.deepEqual(actions[0], { id: 1, type: 'click', x: 0, y: 49, reason: 'Visible button' });
  assert.equal(actions[1].text, 'hello world');
  assert.equal(actions[2].key, 'ENTER');
});

test('computer-use planner rejects out-of-bounds clicks and oversized plans', () => {
  assert.throws(() => validatePlanActions({ actions: [{ type: 'click', x: 100, y: 0 }] }, 100, 50), /outside screenshot bounds/i);
  assert.throws(() => validatePlanActions({ actions: [{ type: 'click', x: -1, y: 0 }] }, 100, 50), /outside screenshot bounds/i);
  assert.throws(() => validatePlanActions({ actions: Array.from({ length: 9 }, () => ({ type: 'key', key: 'ENTER' })) }, 100, 50), /maximum 8 actions/i);
});

test('computer-use planner rejects sensitive text and unsupported key/action types', () => {
  assert.throws(() => validatePlanActions({ actions: [{ type: 'type', text: 'my password is abc123' }] }, 100, 50), /sensitive-looking text/i);
  assert.throws(() => validatePlanActions({ actions: [{ type: 'key', key: 'CTRL+ALT+DELETE' }] }, 100, 50), /unsupported/i);
  assert.throws(() => validatePlanActions({ actions: [{ type: 'shell', command: 'whoami' }] }, 100, 50), /unsupported type/i);
});

test('computer-use native input requires an explicit approval flag', () => {
  assert.throws(() => assertApproved({ approved: false }), /explicit user approval/i);
  assert.throws(() => assertApproved({}), /explicit user approval/i);
  assert.doesNotThrow(() => assertApproved({ approved: true }));
});

test('computer-use outcome verification normalizes evidence and rejects overconfident invalid output', () => {
  const { normalizeVerification } = require('../electron/computer-use.cjs');
  assert.deepEqual(normalizeVerification({ status: 'verified', confidence: 0.876, evidence: 'A success banner is visible.', nextStep: 'Inspect manually.' }), {
    status: 'verified', confidence: 0.88, evidence: 'A success banner is visible.', nextStep: 'Inspect manually.'
  });
  assert.equal(normalizeVerification({ status: 'uncertain', confidence: 0.2 }).status, 'uncertain');
  assert.throws(() => normalizeVerification({ status: 'done', confidence: 1 }), /unsupported status/i);
  assert.throws(() => normalizeVerification({ status: 'verified', confidence: 1.2 }), /confidence/i);
  assert.throws(() => normalizeVerification({ status: 'verified', confidence: 'high' }), /confidence/i);
});
