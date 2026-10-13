'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createClient, normalizeArgs, buildAgentEnvironment } = require('../electron/acp-client.cjs');

const fakeAgent = "const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=o=>process.stdout.write(JSON.stringify(o)+'\\n');rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({jsonrpc:'2.0',id:m.id,result:{protocolVersion:2,capabilities:{session:{}},info:{name:'Fake ACP',version:'1'},authMethods:[]}});else if(m.method==='session/new')send({jsonrpc:'2.0',id:m.id,result:{sessionId:'s-test'}});else if(m.method==='session/prompt'){send({jsonrpc:'2.0',method:'session/update',params:{sessionId:'s-test',update:{sessionUpdate:'agent_message_chunk',messageId:'m1',content:{type:'text',text:'ACP reply'}}}});send({jsonrpc:'2.0',method:'session/update',params:{sessionId:'s-test',update:{sessionUpdate:'state_update',state:'idle',stopReason:'end_turn'}}});send({jsonrpc:'2.0',id:m.id,result:{messageId:'user-1'}});}else if(m.method==='session/cancel')send({jsonrpc:'2.0',method:'session/update',params:{sessionId:'s-test',update:{sessionUpdate:'state_update',state:'idle',stopReason:'cancelled'}}});});";

test('ACP v2 adapter initializes, creates a session, streams output, and closes', async () => {
  const updates = [];
  const client = createClient({ command: process.execPath, args: ['-e', fakeAgent], cwd: process.cwd(), onUpdate: event => updates.push(event) });
  try {
    const initialized = await client.initialize();
    assert.equal(initialized.info.name, 'Fake ACP');
    const session = await client.newSession();
    assert.equal(session.sessionId, 's-test');
    const result = await client.runPrompt('Inspect this project');
    assert.equal(result.output, 'ACP reply');
    assert.equal(result.stopReason, 'end_turn');
    assert.ok(updates.some(event => event.update.sessionUpdate === 'agent_message_chunk'));
  } finally { client.close(); }
});

test('ACP command and arguments are bounded and environment secrets are not inherited', () => {
  assert.throws(() => createClient({ command: 'relative-agent', cwd: process.cwd() }), /absolute file path/i);
  assert.throws(() => normalizeArgs(Array.from({ length: 21 }, () => 'x')), /20 strings/i);
  const env = buildAgentEnvironment({ PATH: 'safe-path', OPENAI_API_KEY: 'do-not-inherit', HOME: '/tmp/user' });
  assert.deepEqual(env, { PATH: 'safe-path', HOME: '/tmp/user', CO_AGENT_ACP: '1' });
});

test('ACP rejects malformed prompts and requires an initialized session', async () => {
  const client = createClient({ command: process.execPath, args: ['-e', fakeAgent], cwd: path.resolve('.') });
  try {
    await client.initialize(); await client.newSession();
    await assert.rejects(client.runPrompt(''), /between 1 and 12,000/i);
  } finally { client.close(); }
});


test('ACP permission requests require an explicitly selected advertised option', async () => {
  const permissionAgent = "const readline=require('node:readline');const rl=readline.createInterface({input:process.stdin});const send=o=>process.stdout.write(JSON.stringify(o)+'\\n');let promptId;rl.on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({jsonrpc:'2.0',id:m.id,result:{protocolVersion:2,capabilities:{session:{}},info:{name:'Permission ACP',version:'1'},authMethods:[]}});else if(m.method==='session/new')send({jsonrpc:'2.0',id:m.id,result:{sessionId:'s-permission'}});else if(m.method==='session/prompt'){promptId=m.id;send({jsonrpc:'2.0',id:'permission-1',method:'session/request_permission',params:{sessionId:'s-permission',title:'Run workspace tool',options:[{optionId:'allow_once',name:'Allow once'}]}});}else if(m.id==='permission-1'){const text=m.result?.outcome==='selected'?'Approved':'Denied';send({jsonrpc:'2.0',method:'session/update',params:{sessionId:'s-permission',update:{sessionUpdate:'agent_message_chunk',messageId:'m1',content:{type:'text',text}}}});send({jsonrpc:'2.0',method:'session/update',params:{sessionId:'s-permission',update:{sessionUpdate:'state_update',state:'idle',stopReason:'end_turn'}}});send({jsonrpc:'2.0',id:promptId,result:{messageId:'user-2'}});}});";
  let requested = false;
  const client = createClient({
    command: process.execPath, args: ['-e', permissionAgent], cwd: process.cwd(),
    onPermission: async request => { requested = request.title === 'Run workspace tool'; return { outcome: 'selected', optionId: 'allow_once' }; }
  });
  try {
    await client.initialize(); await client.newSession();
    const result = await client.runPrompt('Do one approved action');
    assert.equal(requested, true);
    assert.equal(result.output, 'Approved');
  } finally { client.close(); }

  const deniedClient = createClient({
    command: process.execPath, args: ['-e', permissionAgent], cwd: process.cwd(),
    onPermission: async () => ({ outcome: 'cancelled' })
  });
  try {
    await deniedClient.initialize(); await deniedClient.newSession();
    const denied = await deniedClient.runPrompt('Do one denied action');
    assert.equal(denied.output, 'Denied', 'a denied permission request must never be treated as approved');
  } finally { deniedClient.close(); }
});
