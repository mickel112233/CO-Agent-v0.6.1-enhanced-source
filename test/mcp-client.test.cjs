'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient, validateServerUrl, normalizeTools, normalizeToolArguments, extractMcpParamHeaders } = require('../electron/mcp-client.cjs');

test('MCP server URLs require HTTPS or loopback HTTP and reject embedded credentials', () => {
  assert.equal(validateServerUrl('http://127.0.0.1:8765/mcp'), 'http://127.0.0.1:8765/mcp');
  assert.equal(validateServerUrl('https://mcp.example.com/api'), 'https://mcp.example.com/api');
  assert.throws(() => validateServerUrl('http://mcp.example.com/api'), /HTTPS/i);
  assert.throws(() => validateServerUrl('https://user:pass@mcp.example.com/api'), /credentials/i);
  assert.throws(() => validateServerUrl('https://mcp.example.com/api?token=x'), /query parameters/i);
  assert.throws(() => validateServerUrl('not a URL'), /invalid/i);
});

test('MCP tool catalog and arguments are bounded and validated', () => {
  assert.deepEqual(normalizeTools([{ name: 'read_file', description: 'Read selected file', inputSchema: { type: 'object' } }]).map(item => item.name), ['read_file']);
  assert.throws(() => normalizeTools([{ name: '../shell' }]), /invalid name/i);
  assert.throws(() => normalizeTools(Array.from({ length: 101 }, (_, i) => ({ name: 'tool_' + i }))), /100 tools/i);
  assert.throws(() => normalizeToolArguments({ data: 'x'.repeat(33000) }), /32 KB/i);
  assert.throws(() => normalizeToolArguments(['not', 'object']), /JSON object/i);
});

test('MCP client initializes, lists tools, calls tools, and bounds returned text', async () => {
  const requests = [];
  const responses = [
    { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 'session-1' }, body: { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2026-07-28', capabilities: { tools: {} }, serverInfo: { name: 'Example MCP', version: '1' } } } },
    { status: 202, headers: { 'content-type': 'application/json' }, body: null },
    { status: 200, headers: { 'content-type': 'application/json' }, body: { jsonrpc: '2.0', id: 3, result: { tools: [{ name: 'echo', description: 'Echo input', inputSchema: { type: 'object', properties: { region: { type: 'string', 'x-mcp-header': 'Region' } } } }] } } },
    { status: 200, headers: { 'content-type': 'application/json' }, body: { jsonrpc: '2.0', id: 4, result: { content: [{ type: 'text', text: 'hello' }] } } }
  ];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const response = responses.shift();
    return { ok: response.status >= 200 && response.status < 300, status: response.status, headers: { get: key => response.headers[key.toLowerCase()] || null }, text: async () => response.body == null ? '' : JSON.stringify(response.body) };
  };
  const client = createClient('http://localhost:8765/mcp', { fetch: fetchImpl });
  const catalog = await client.listTools();
  assert.equal(catalog.serverInfo.name, 'Example MCP');
  assert.equal(catalog.tools[0].name, 'echo');
  const result = await client.callTool('echo', { value: 'hello', region: 'us-east-1' });
  assert.equal(result.content[0].text, 'hello');
  assert.equal(requests[0].options.headers['mcp-protocol-version'], '2026-07-28');
  assert.equal(requests[0].options.headers['mcp-method'], 'initialize');
  assert.equal(requests[2].options.headers['mcp-method'], 'tools/list');
  assert.equal(requests[3].options.headers['mcp-name'], 'echo');
  assert.equal(requests[3].options.headers['mcp-param-Region'], 'us-east-1');
  assert.deepEqual(JSON.parse(requests[3].options.body).params.arguments, { value: 'hello', region: 'us-east-1' });
});

test('MCP client rejects mismatched JSON-RPC IDs and server errors', async () => {
  const client = createClient('https://mcp.example.com', { fetch: async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 999, result: {} }) }) });
  await assert.rejects(client.initialize(), /ID did not match/i);
});

test('MCP custom header values cannot inject headers or non-ASCII data', () => {
  const schema = { properties: { region: { type: 'string', 'x-mcp-header': 'Region' } } };
  assert.deepEqual(extractMcpParamHeaders(schema, { region: 'us-east-1' }), { 'mcp-param-Region': 'us-east-1' });
  assert.throws(() => extractMcpParamHeaders(schema, { region: 'us-east-1\nX-Admin: true' }), /printable ASCII/i);
  assert.throws(() => extractMcpParamHeaders(schema, { region: '東京' }), /printable ASCII/i);
});

test('MCP client interoperates with a real local HTTP server using JSON-RPC messages', async t => {
  const http = require('node:http');
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString();
    const message = JSON.parse(raw);
    requests.push({ method: message.method, headers: req.headers });
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(body == null ? '' : JSON.stringify({ jsonrpc: '2.0', id: message.id, result: body }));
    };
    if (message.method === 'initialize') return send(200, { protocolVersion: '2026-07-28', capabilities: { tools: {} }, serverInfo: { name: 'CO-Agent local MCP fixture', version: '1.0' } });
    if (message.method === 'notifications/initialized') { res.statusCode = 202; return res.end(); }
    if (message.method === 'tools/list') return send(200, { tools: [{ name: 'echo', description: 'Echo a value', inputSchema: { type: 'object', properties: { text: { type: 'string' } } }] });
    if (message.method === 'tools/call') return send(200, { content: [{ type: 'text', text: 'local MCP: ' + message.params.arguments.text }] });
    res.statusCode = 400; res.end(JSON.stringify({ error: 'unknown method' }));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const client = createClient('http://127.0.0.1:' + address.port + '/mcp');
  const catalog = await client.listTools();
  assert.equal(catalog.serverInfo.name, 'CO-Agent local MCP fixture');
  assert.equal(catalog.tools[0].name, 'echo');
  const result = await client.callTool('echo', { text: 'round-trip' });
  assert.equal(result.content[0].text, 'local MCP: round-trip');
  assert.ok(requests.some(item => item.method === 'initialize'));
  assert.ok(requests.some(item => item.method === 'tools/call'));
  assert.equal(requests.find(item => item.method === 'tools/call').headers['mcp-name'], 'echo');
});
