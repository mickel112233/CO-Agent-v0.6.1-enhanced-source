'use strict';

const CURRENT_PROTOCOL = '2026-07-28';
const LEGACY_PROTOCOL = '2025-03-26';
const MAX_BODY = 1024 * 1024;
const MAX_TOOLS = 100;
const MAX_TOOL_OUTPUT = 16000;

function validateServerUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('Enter an MCP server URL under 2,048 characters.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('The MCP server URL is invalid.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('MCP servers must use HTTPS (HTTP is allowed only for loopback local servers).');
  if (url.username || url.password || url.search || url.hash) throw new Error('MCP server URLs cannot contain credentials, query parameters, or fragments.');
  return url.toString();
}
function normalizeTools(input) {
  if (!Array.isArray(input)) throw new Error('MCP server returned an invalid tools list.');
  if (input.length > MAX_TOOLS) throw new Error('MCP server returned more than 100 tools.');
  return input.map(tool => {
    if (!tool || typeof tool.name !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) throw new Error('MCP server returned a tool with an invalid name.');
    const schema = tool.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema) ? tool.inputSchema : { type: 'object', properties: {} };
    if (JSON.stringify(schema).length > 20000) throw new Error('MCP tool input schema exceeds 20 KB.');
    return { name: tool.name, description: String(tool.description || '').slice(0, 1200), inputSchema: schema, annotations: tool.annotations && typeof tool.annotations === 'object' ? tool.annotations : {} };
  });
}
function extractMcpParamHeaders(schema, args, prefix = '') {
  const headers = {};
  for (const [key, property] of Object.entries(schema?.properties || {})) {
    const value = args?.[key];
    const headerName = property?.['x-mcp-header'];
    if (headerName && value != null) {
      if (typeof headerName !== 'string' || !/^[A-Za-z0-9-]{1,60}$/.test(headerName)) throw new Error('MCP tool schema contains an invalid x-mcp-header name.');
      const text = String(value);
      if (/[\r\n]/.test(text) || /[^\x20-\x7e]/.test(text) || text.length > 1000) throw new Error('MCP custom header values must be printable ASCII and no longer than 1,000 characters.');
      headers['mcp-param-' + headerName] = text;
    }
    if (property?.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) Object.assign(headers, extractMcpParamHeaders(property, value, prefix + key + '.'));
  }
  return headers;
}
function normalizeToolArguments(args) {
  if (args == null) args = {};
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('MCP tool arguments must be a JSON object.');
  if (JSON.stringify(args).length > 32000) throw new Error('MCP tool arguments exceed 32 KB.');
  return args;
}
function createClient(serverUrl, options = {}) {
  const endpoint = validateServerUrl(serverUrl);
  const fetchImpl = options.fetch || fetch;
  const timeoutMs = Math.max(1000, Math.min(30000, Number(options.timeoutMs) || 15000));
  let nextId = 1;
  let sessionId = '';
  let protocolVersion = CURRENT_PROTOCOL;
  let legacySessionMode = false;
  let initialized = false;
  let serverInfo = null;
  let toolSchemas = new Map();
  async function request(method, params = {}, notification = false, extraHeaders = {}) {
    const id = nextId++;
    const requestParams = !notification && initialized && method !== 'initialize' ? { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': protocolVersion, 'io.modelcontextprotocol/clientInfo': { name: 'CO-Agent', version: '0.6.1' }, 'io.modelcontextprotocol/clientCapabilities': {} } } : params;
    const payload = notification ? { jsonrpc: '2.0', method, params: requestParams } : { jsonrpc: '2.0', id, method, params: requestParams };
    const methodHeaders = { 'mcp-method': method };
    if (method === 'tools/call' && typeof params?.name === 'string') methodHeaders['mcp-name'] = params.name;
    const response = await fetchImpl(endpoint, {
      method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': protocolVersion, ...methodHeaders, ...(legacySessionMode && sessionId ? { 'mcp-session-id': sessionId } : {}), ...extraHeaders },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs)
    });
    const returnedSession = response.headers?.get?.('mcp-session-id');
    if (returnedSession) sessionId = returnedSession.slice(0, 500);
    if (notification && (response.status === 202 || response.status === 204)) return null;
    if (!response.ok) throw new Error('MCP server returned HTTP ' + response.status + '.');
    const raw = await response.text();
    if (raw.length > MAX_BODY) throw new Error('MCP server response exceeds the 1 MB safety limit.');
    let envelope;
    if (String(response.headers?.get?.('content-type') || '').includes('text/event-stream')) {
      const data = raw.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).filter(Boolean);
      for (const item of data.reverse()) { try { envelope = JSON.parse(item); if (envelope?.id === id || notification) break; } catch {} }
    } else {
      try { envelope = raw ? JSON.parse(raw) : null; } catch { throw new Error('MCP server returned invalid JSON.'); }
    }
    if (notification) return null;
    if (!envelope || envelope.id !== id) throw new Error('MCP response ID did not match the request.');
    if (envelope.error) throw new Error('MCP error ' + String(envelope.error.code ?? '') + ': ' + String(envelope.error.message || 'Unknown error').slice(0, 1000));
    if (!Object.prototype.hasOwnProperty.call(envelope, 'result')) throw new Error('MCP response has no result.');
    return envelope.result;
  }
  async function initialize() {
    if (initialized) return { ok: true, serverInfo };
    let result;
    try {
      protocolVersion = CURRENT_PROTOCOL;
      result = await request('initialize', { protocolVersion: CURRENT_PROTOCOL, capabilities: {}, clientInfo: { name: 'CO-Agent', version: '0.6.1' } });
    } catch (error) {
      if (!/HTTP (400|404|406|415)/i.test(error.message || '')) throw error;
      protocolVersion = LEGACY_PROTOCOL; legacySessionMode = true;
      result = await request('initialize', { protocolVersion: LEGACY_PROTOCOL, capabilities: {}, clientInfo: { name: 'CO-Agent', version: '0.6.1' } });
    }
    if (!result || typeof result !== 'object') throw new Error('MCP server initialization returned no capabilities.');
    protocolVersion = String(result.protocolVersion || protocolVersion);
    legacySessionMode = protocolVersion !== CURRENT_PROTOCOL;
    if (protocolVersion !== CURRENT_PROTOCOL && protocolVersion !== LEGACY_PROTOCOL) throw new Error('MCP server selected an unsupported protocol version: ' + protocolVersion);
    serverInfo = result.serverInfo && typeof result.serverInfo === 'object' ? { name: String(result.serverInfo.name || 'MCP server').slice(0, 120), version: String(result.serverInfo.version || '').slice(0, 80) } : { name: 'MCP server', version: '' };
    await request('notifications/initialized', {}, true);
    initialized = true;
    return { ok: true, serverInfo };
  }
  return Object.freeze({
    endpoint,
    initialize,
    listTools: async () => {
      await initialize();
      const result = await request('tools/list', {});
      const tools = normalizeTools(result?.tools);
      toolSchemas = new Map(tools.map(tool => [tool.name, tool.inputSchema]));
      return { ok: true, serverInfo, tools };
    },
    callTool: async (name, args = {}) => {
      await initialize();
      if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(name)) throw new Error('MCP tool name is invalid.');
      const safeArgs = normalizeToolArguments(args);
      const schema = toolSchemas.get(name);
      if (!schema) throw new Error('Only tools discovered from this MCP server can be called. Refresh the tool list and retry.');
      const customHeaders = extractMcpParamHeaders(schema, safeArgs);
      const result = await request('tools/call', { name, arguments: safeArgs }, false, customHeaders);
      const content = Array.isArray(result?.content) ? result.content.slice(0, 100).map(item => {
        if (!item || typeof item !== 'object') return { type: 'text', text: String(item || '').slice(0, 1000) };
        return { type: String(item.type || 'text').slice(0, 40), text: String(item.text || '').slice(0, 4000), mimeType: item.mimeType ? String(item.mimeType).slice(0, 100) : undefined };
      }) : [];
      let remaining = MAX_TOOL_OUTPUT;
      const bounded = content.map(item => { const text = item.text.slice(0, remaining); remaining -= text.length; return { ...item, text }; }).filter(item => item.text || item.type !== 'text');
      return { ok: true, isError: result?.isError === true, content: bounded, structuredContent: result?.structuredContent == null ? null : JSON.stringify(result.structuredContent).slice(0, MAX_TOOL_OUTPUT) };
    }
  });
}
module.exports = { createClient, validateServerUrl, normalizeTools, normalizeToolArguments, extractMcpParamHeaders, CURRENT_PROTOCOL, LEGACY_PROTOCOL, MAX_BODY, MAX_TOOLS, MAX_TOOL_OUTPUT };
