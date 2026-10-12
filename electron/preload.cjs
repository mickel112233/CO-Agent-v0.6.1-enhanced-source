'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);
const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('coAgent', Object.freeze({
  app: Object.freeze({ name: 'CO-Agent', version: '0.6.1' }),
  chatHistory: Object.freeze({ load: invoke('chat-history:load'), save: invoke('chat-history:save') }),
  agents: Object.freeze({ list: invoke('agents:list'), planWorkflow: invoke('agents:plan-workflow'), runStep: invoke('agents:run-step'), listRuns: invoke('agents:runs:list'), createRun: invoke('agents:runs:create'), updateRunStep: invoke('agents:runs:update-step'), pauseRun: invoke('agents:runs:pause'), resumeRun: invoke('agents:runs:resume'), cancelRun: invoke('agents:runs:cancel') }),
  workspace: Object.freeze({ getRoot: invoke('workspace:get-root'), chooseRoot: invoke('workspace:choose-root'), listFiles: invoke('workspace:list-files'), readFile: invoke('workspace:read-file'), applyChanges: invoke('workspace:apply-changes') }),
  terminal: Object.freeze({ listCommands: invoke('terminal:list-commands'), runCommand: invoke('terminal:run-command'), cancelCommand: invoke('terminal:cancel-command'), onOutput: callback => subscribe('terminal:output', callback) }),
  platform: process.platform,
  runtime: Object.freeze({
    ollamaStatus: invoke('runtime:ollama-status'),
    hardwareInfo: invoke('runtime:hardware-info'),
    ollamaModels: invoke('runtime:ollama-models'),
    pullModel: invoke('runtime:ollama-pull'),
    cancelPull: invoke('runtime:ollama-pull-cancel'),
    onPullProgress: callback => subscribe('runtime:ollama-pull-progress', callback),
    deleteModel: invoke('runtime:ollama-delete'),
    chat: invoke('runtime:chat'),
    cancelChat: invoke('runtime:chat-cancel'),
    onChatChunk: callback => subscribe('runtime:chat-chunk', callback)
  }),
  computer: Object.freeze({ allowedApps: invoke('computer:allowed-apps'), launchApp: invoke('computer:launch-app'), openPath: invoke('computer:open-path') }),
  computerUse: Object.freeze({ captureScreen: invoke('computer-use:capture-screen'), inspectAccessibility: invoke('computer-use:inspect-accessibility'), readScreenText: invoke('computer-use:read-screen-text'), planActions: invoke('computer-use:plan-actions'), verifyOutcome: invoke('computer-use:verify-outcome'), click: invoke('computer-use:click'), typeText: invoke('computer-use:type-text'), pressKey: invoke('computer-use:press-key') }),
  studio: Object.freeze({
    capabilities: invoke('studio:capabilities'), probe: invoke('studio:probe'), extractAudio: invoke('studio:extract-audio'), concat: invoke('studio:concat'),
    saveProject: invoke('studio:save-project'), loadProject: invoke('studio:load-project'), renderTimeline: invoke('studio:render-timeline'), cancelRender: invoke('studio:cancel-render'), onRenderProgress: callback => subscribe('studio:render-progress', callback),
    ocrStatus: invoke('studio:ocr-status'), ocrImage: invoke('studio:ocr-image'),
    hyperframesStatus: invoke('studio:hyperframes-status'), hyperframesRun: invoke('studio:hyperframes-run')
  }),
  integrations: Object.freeze({
    status: invoke('integrations:status'),
    installTool: invoke('integrations:install-tool'),
    listRepos: invoke('integrations:list-repos'),
    getSkills: invoke('integrations:get-skills'),
    installRepo: invoke('integrations:install-repo'),
    removeRepo: invoke('integrations:remove-repo'),
    listMcpTools: invoke('integrations:mcp-tools'),
    callMcpTool: invoke('integrations:mcp-call'),
    runAcp: invoke('integrations:acp-run'),
    cancelAcp: invoke('integrations:acp-cancel'),
    onAcpUpdate: callback => subscribe('integrations:acp-update', callback)
  }),
  voice: Object.freeze({ synthesize: invoke('voice:synthesize') }),
  dialog: Object.freeze({ openFiles: invoke('dialog:open-files'), openTextFiles: invoke('dialog:open-text-files'), saveFile: invoke('dialog:save-file'), chooseDirectory: invoke('dialog:choose-directory') })
}));
