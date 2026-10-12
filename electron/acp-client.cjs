'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const MAX_LINE = 1024 * 1024;
const MAX_PROMPT = 12000;
const MAX_OUTPUT = 60000;
const DEFAULT_TIMEOUT = 30000;

function normalizeArgs(args) {
  if (args == null) args = [];
  if (!Array.isArray(args) || args.length > 20 || args.some(arg => typeof arg !== 'string' || arg.length > 500 || arg.includes('\0'))) throw new Error('ACP executable arguments must be an array of at most 20 strings, each under 500 characters.');
  return args.slice();
}
function safeText(value, max = 2000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').slice(0, max);
}
function contentText(content) {
  const blocks = Array.isArray(content) ? content : [content];
  return blocks.filter(block => block && block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('');
}
function buildAgentEnvironment(source = process.env) {
  const allowed = ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'LC_ALL', 'TERM', 'ComSpec', 'PATHEXT'];
  const env = {};
  for (const key of allowed) if (typeof source[key] === 'string') env[key] = source[key];
  env.CO_AGENT_ACP = '1';
  return env;
}
function createClient(options = {}) {
  const command = String(options.command || '');
  if (!path.isAbsolute(command) || command.length > 2048 || command.includes('\0')) throw new Error('ACP executable must be an absolute file path selected by the user.');
  const args = normalizeArgs(options.args);
  const cwd = path.resolve(String(options.cwd || ''));
  if (!options.cwd || !path.isAbsolute(cwd)) throw new Error('ACP requires an absolute workspace directory.');
  const spawnImpl = options.spawn || spawn;
  const timeoutMs = Math.max(1000, Math.min(60000, Number(options.timeoutMs) || DEFAULT_TIMEOUT));
  const onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : () => {};
  const onPermission = typeof options.onPermission === 'function' ? options.onPermission : async () => ({ outcome: 'cancelled' });
  let child = null, sessionId = '', initialized = false, closed = false, nextId = 1, buffer = '', stderr = '', idleVersion = 0;
  const pending = new Map(), idleWaiters = new Set(), messageText = new Map();
  let output = '', lastStopReason = '';

  function failAll(error) {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
    for (const waiter of idleWaiters) { clearTimeout(waiter.timer); waiter.reject(error); }
    idleWaiters.clear();
  }
  function terminate(error) {
    if (closed) return;
    closed = true;
    failAll(error instanceof Error ? error : new Error(String(error || 'ACP agent stopped.')));
    try { child?.kill(); } catch {}
  }
  function send(payload) {
    if (!child || closed || !child.stdin?.writable) throw new Error('ACP agent process is not available.');
    const line = JSON.stringify(payload) + '\n';
    if (line.length > MAX_LINE) throw new Error('ACP message exceeds the 1 MB limit.');
    child.stdin.write(line);
  }
  function notify(method, params = {}) { send({ jsonrpc: '2.0', method, params }); }
  function request(method, params = {}, timeout = timeoutMs) {
    if (closed) return Promise.reject(new Error('ACP agent process is closed.'));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('ACP request timed out: ' + method)); }, timeout);
      pending.set(id, { resolve, reject, timer });
      try { send({ jsonrpc: '2.0', id, method, params }); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  function waitForIdle(afterVersion, timeout = 300000) {
    if (idleVersion > afterVersion) return Promise.resolve({ output, stopReason: lastStopReason });
    return new Promise((resolve, reject) => {
      const waiter = { afterVersion, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => { idleWaiters.delete(waiter); reject(new Error('ACP agent did not report an idle state within the allowed time.')); }, timeout);
      idleWaiters.add(waiter);
    });
  }
  function emitUpdate(update, params) {
    if (!update || typeof update !== 'object') return;
    if (update.sessionUpdate === 'agent_message_chunk' && update.messageId) messageText.set(String(update.messageId), (messageText.get(String(update.messageId)) || '') + contentText(update.content));
    else if (update.sessionUpdate === 'agent_message' && update.messageId && Array.isArray(update.content)) messageText.set(String(update.messageId), contentText(update.content));
    output = [...messageText.values()].join('\n').slice(-MAX_OUTPUT);
    if (update.sessionUpdate === 'state_update' && update.state === 'idle') {
      lastStopReason = safeText(update.stopReason, 100);
      idleVersion++;
      const event = { output, stopReason: safeText(update.stopReason, 100), state: 'idle' };
      for (const waiter of [...idleWaiters]) if (idleVersion > waiter.afterVersion) { clearTimeout(waiter.timer); idleWaiters.delete(waiter); waiter.resolve(event); }
    }
    try { onUpdate({ sessionId: String(params?.sessionId || sessionId), update, output, state: update.sessionUpdate === 'state_update' ? update.state : undefined }); } catch {}
  }
  async function handleMessage(message) {
    if (!message || message.jsonrpc !== '2.0') { terminate(new Error('ACP agent wrote an invalid JSON-RPC message to stdout.')); return; }
    if (message.method === 'session/update') { emitUpdate(message.params?.update, message.params); return; }
    if (message.method && Object.prototype.hasOwnProperty.call(message, 'id')) {
      if (message.method === 'session/request_permission') {
        let result = { outcome: 'cancelled' };
        try {
          const requested = await onPermission(message.params || {});
          const opts = Array.isArray(message.params?.options) ? message.params.options : [];
          if (requested?.outcome === 'selected' && opts.some(item => item.optionId === requested.optionId)) result = requested;
        } catch {}
        try { send({ jsonrpc: '2.0', id: message.id, result }); } catch {}
      } else try { send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Client method not supported.' } }); } catch {}
      return;
    }
    if (Object.prototype.hasOwnProperty.call(message, 'id')) {
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer); pending.delete(message.id);
      if (message.error) item.reject(new Error('ACP error ' + String(message.error.code ?? '') + ': ' + safeText(message.error.message, 1000)));
      else if (Object.prototype.hasOwnProperty.call(message, 'result')) item.resolve(message.result);
      else item.reject(new Error('ACP response has neither result nor error.'));
    }
  }
  function start() {
    if (child) return;
    if (closed) throw new Error('ACP agent process has already been closed.');
    child = spawnImpl(command, args, { cwd, env: buildAgentEnvironment(options.env || process.env), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (buffer.length > MAX_LINE) { terminate(new Error('ACP agent sent an oversized message.')); return; }
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { terminate(new Error('ACP agent wrote non-JSON output to stdout. Ensure the executable is an ACP server, not a regular CLI.')); return; }
        void handleMessage(message);
      }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-6000); });
    child.on('error', error => terminate(new Error('Could not start ACP agent: ' + error.message)));
    child.on('close', code => { if (!closed) terminate(new Error('ACP agent exited (' + code + '). ' + stderr.slice(-1500))); });
  }
  return Object.freeze({
    get sessionId() { return sessionId; }, get output() { return output; }, get stderr() { return stderr; },
    initialize: async () => {
      start();
      const result = await request('initialize', { protocolVersion: 2, capabilities: {}, info: { name: 'CO-Agent', title: 'CO-Agent', version: '0.6.1' } });
      if (result?.protocolVersion !== 2) throw new Error('ACP agent did not negotiate protocol version 2.');
      if (Array.isArray(result.authMethods) && result.authMethods.length) throw new Error('This ACP adapter does not support agent-provided login flows yet. Authenticate with the agent separately and retry.');
      if (!result.capabilities || !Object.prototype.hasOwnProperty.call(result.capabilities, 'session')) throw new Error('ACP agent does not advertise session support.');
      initialized = true;
      return { info: result.info || {}, capabilities: result.capabilities };
    },
    newSession: async () => {
      if (!initialized) throw new Error('Initialize the ACP agent before creating a session.');
      const result = await request('session/new', { cwd, mcpServers: [] });
      if (typeof result?.sessionId !== 'string' || !result.sessionId || result.sessionId.length > 500) throw new Error('ACP agent returned an invalid session ID.');
      sessionId = result.sessionId;
      return { sessionId };
    },
    runPrompt: async prompt => {
      if (!sessionId) throw new Error('Create an ACP session before sending a prompt.');
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) throw new Error('ACP prompt must contain between 1 and 12,000 characters.');
      const previousIdle = idleVersion;
      const accepted = await request('session/prompt', { sessionId, prompt: [{ type: 'text', text: prompt.trim() }] }, 60000);
      if (typeof accepted?.messageId !== 'string' || !accepted.messageId) throw new Error('ACP agent did not acknowledge the prompt with a message ID.');
      const result = await waitForIdle(previousIdle);
      return { ok: true, sessionId, messageId: accepted.messageId, output: result.output, stopReason: result.stopReason };
    },
    cancel: async () => {
      if (!child || closed) return { cancelled: false };
      if (!sessionId) { terminate(new Error('ACP session cancelled before initialization completed.')); return { cancelled: true }; }
      const previousIdle = idleVersion;
      try { notify('session/cancel', { sessionId }); await waitForIdle(previousIdle, 10000); }
      catch { terminate(new Error('ACP agent did not stop after cancellation; its process was terminated.')); }
      return { cancelled: true };
    },
    close: () => { if (!closed) terminate(new Error('ACP client closed.')); }
  });
}
module.exports = { createClient, normalizeArgs, safeText, contentText, buildAgentEnvironment, MAX_LINE, MAX_PROMPT, MAX_OUTPUT };
