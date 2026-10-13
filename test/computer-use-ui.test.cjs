'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Computer Use discards a planned sequence after both successful and failed input attempts', () => {
  const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'src', 'ComputerUse.jsx'), 'utf8');
  assert.match(source, /async function runPlanned\(action\)/);
  assert.match(source, /try\s*\{\s*await perform\(action\.type, payload, summary \+ '\. Reason: ' \+ action\.reason\);\s*\}\s*finally\s*\{[\s\S]*?setPlan\(\[\]\);/);
  assert.match(source, /A failed input can still partially change the desktop/);
});
