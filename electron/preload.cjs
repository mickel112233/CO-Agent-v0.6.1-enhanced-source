'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);
const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('coAgent', Object.freeze({
  app: Object.freeze({ name: 'CO-Agent', version: '0.6.1' }),
  imports: Object.freeze({ scanZip: invoke('imports:scan-zip'), installNodeDependencies: invoke('imports:install-node-dependencies'), getPathForFile: file => { try { return webUtils.getPathForFile(file); } catch { return ''; } } }),
  chatHistory: Object.freeze({ load: invoke('chat-history:load'), save: invoke('chat-history:save') }),
  agents: Object.freeze({ list: invoke('agents:list'), planWorkflow: invoke('agents:plan-workflow'), runStep: invoke('agents:run-step') }),
  workspace: Object.freeze({ getRoot: invoke('workspace:get-root'), chooseRoot: invoke('workspace:choose-root'), listFiles: invoke('workspace:list-files'), readFile: invoke('workspace:read-file'), applyChanges: invoke('workspace:apply-changes') }),
  terminal: Object.freeze({ listCommands: invoke('terminal:list-commands'), runCommand: invoke('terminal:run-command'), cancelCommand: invoke('terminal:cancel-command'), onOutput: callback => subscribe('terminal:output', callback) }),
  platform: process.platform,
  runtime: Object.freeze({
    ollamaStatus: invoke('runtime:ollama-status'),
    hardwareInfo: invoke('runtime:hardware-info'),
    ollamaModels: invoke('runtime:ollama-models'),
    pullModel: invoke('runtime:ollama-pull'),
    onPullProgress: callback => subscribe('runtime:ollama-pull-progress', callback),
    deleteModel: invoke('runtime:ollama-delete'),
    chat: invoke('runtime:chat'),
    cancelChat: invoke('runtime:chat-cancel')
  }),
  computer: Object.freeze({ allowedApps: invoke('computer:allowed-apps'), launchApp: invoke('computer:launch-app'), openPath: invoke('computer:open-path') }),
  computerUse: Object.freeze({ captureScreen: invoke('computer-use:capture-screen'), inspectAccessibility: invoke('computer-use:inspect-accessibility'), invokeControl: invoke('computer-use:invoke-control'), readScreenText: invoke('computer-use:read-screen-text'), planActions: invoke('computer-use:plan-actions'), verifyOutcome: invoke('computer-use:verify-outcome'), click: invoke('computer-use:click'), typeText: invoke('computer-use:type-text'), pressKey: invoke('computer-use:press-key') }),
  studio: Object.freeze({
    capabilities: invoke('studio:capabilities'), probe: invoke('studio:probe'), extractAudio: invoke('studio:extract-audio'), concat: invoke('studio:concat'),
    generateSoundEffect: invoke('studio:generate-sound-effect'),
    saveProject: invoke('studio:save-project'), loadProject: invoke('studio:load-project'), renderTimeline: invoke('studio:render-timeline'),
    ocrStatus: invoke('studio:ocr-status'), ocrImage: invoke('studio:ocr-image'),
    hyperframesStatus: invoke('studio:hyperframes-status'), hyperframesRun: invoke('studio:hyperframes-run'), hyperframesCreateComposition: invoke('studio:hyperframes-create')
  }),
  audit: Object.freeze({ list: invoke('audit:list') }),
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
  pet: Object.freeze({ status: invoke('pet:status'), launch: invoke('pet:launch'), close: invoke('pet:close'), showOverlay: invoke('pet:show-overlay'), hideOverlay: invoke('pet:hide-overlay'), toggleOverlay: invoke('pet:toggle-overlay'), onIncomingMessage: callback => subscribe('pet:incoming-message', callback) }),
  luxTTS: Object.freeze({ status: invoke('luxtts:status'), setup: invoke('luxtts:setup'), generate: invoke('luxtts:generate'), cancel: invoke('luxtts:cancel'), onSetupProgress: callback => subscribe('luxtts:setup-progress', callback), onGenerationProgress: callback => subscribe('luxtts:generation-progress', callback) }),
  voice: Object.freeze({ synthesize: invoke('voice:synthesize') }),
  dialog: Object.freeze({ openFiles: invoke('dialog:open-files'), openTextFiles: invoke('dialog:open-text-files'), saveFile: invoke('dialog:save-file'), chooseDirectory: invoke('dialog:choose-directory') })
}));
