'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const pet = require('../electron/pet-runtime.cjs');

test('pet executable candidates are Windows-only and use fixed app-owned locations', () => {
  assert.deepEqual(pet.candidates({ platform: 'linux', appPath: '/app' }), []);
  const paths = pet.candidates({ platform: 'win32', appPath: '/app', resourcesPath: '/resources' });
  assert.equal(paths[0], path.resolve('/resources/pet/AI-Desktop-Pet.exe'));
  assert.ok(paths.every(value => value.endsWith('AI-Desktop-Pet.exe')));
});

test('pet status reports source-only state instead of pretending it is installed', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-pet-'));
  try {
    const result = await pet.status({ platform: 'win32', appPath: dir, resourcesPath: path.join(dir, 'resources') });
    assert.equal(result.ok, true);
    assert.equal(result.installed, false);
    assert.equal(result.running, false);
    assert.match(result.message, /has not been built or packaged/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('pet launcher uses an explicit executable, no shell, and prevents duplicate launches', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-pet-'));
  const exe = path.join(dir, 'pet', 'AI-Desktop-Pet.exe');
  await fs.mkdir(path.dirname(exe), { recursive: true });
  await fs.writeFile(exe, 'test executable placeholder');
  const fake = new EventEmitter();
  fake.exitCode = null;
  fake.kill = () => { fake.exitCode = 0; fake.emit('exit', 0); return true; };
  const calls = [];
  const spawn = (...args) => { calls.push(args); queueMicrotask(() => fake.emit('spawn')); return fake; };
  try {
    const options = { platform: 'win32', appPath: dir, resourcesPath: dir, spawn };
    const launched = await pet.launch(options);
    assert.equal(launched.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], exe);
    assert.deepEqual(calls[0][1], []);
    assert.equal(calls[0][2].shell, false);
    assert.equal((await pet.launch(options)).alreadyRunning, true);
    assert.equal(calls.length, 1);
    assert.equal(pet.stop().stopped, true);
    assert.equal(pet.stop().stopped, false);
  } finally { pet.stop(); await fs.rm(dir, { recursive: true, force: true }); }
});

test('pet launch fails clearly until its Tauri executable is packaged', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-agent-pet-missing-'));
  try {
    await assert.rejects(() => pet.launch({ platform: 'win32', appPath: dir, resourcesPath: path.join(dir, 'none') }), /not built yet/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
