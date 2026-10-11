const test = require('node:test');
const assert = require('node:assert/strict');
const { validateHistory } = require('../electron/chat-history.cjs');

test('validates and sorts bounded conversation history', () => {
  const result = validateHistory([
    { id: 'old', title: 'Old', updatedAt: '2025-01-01T00:00:00.000Z', messages: [{ role: 'user', content: 'hello' }] },
    { id: 'new', title: 'New', updatedAt: '2026-01-01T00:00:00.000Z', messages: [{ role: 'assistant', content: 'world' }] }
  ]);
  assert.deepEqual(result.map(item => item.id), ['new', 'old']);
});

test('rejects duplicate IDs, unsupported roles, and oversized history', () => {
  assert.throws(() => validateHistory([{ id: 'x', messages: [] }, { id: 'x', messages: [] }]), /duplicate/i);
  assert.throws(() => validateHistory([{ id: 'x', messages: [{ role: 'system', content: 'no' }] }]), /invalid message/i);
  assert.throws(() => validateHistory([{ id: 'bad/id', messages: [] }]), /invalid.*ID/i);
  assert.throws(() => validateHistory([{ id: 'x', messages: [{ role: 'user', content: 'x'.repeat(17000) }] }]), /2 MB|message/i);
});

test('accepts the versioned on-disk envelope', () => {
  assert.equal(validateHistory({ version: 1, conversations: [{ id: 'chat_1', messages: [] }] }).length, 1);
});
