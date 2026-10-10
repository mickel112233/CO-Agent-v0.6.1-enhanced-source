'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('coAgent', Object.freeze({
  app: Object.freeze({ name: 'CO-Agent', version: '0.6.1' }),
  platform: process.platform,
  runtime: Object.freeze({
    ollamaStatus: invoke('runtime:ollama-status'),
    ollamaModels: invoke('runtime:ollama-models'),
    pullModel: invoke('runtime:ollama-pull'),
    deleteModel: invoke('runtime:ollama-delete'),
    chat: invoke('runtime:chat')
  }),
  computer: Object.freeze({ allowedApps: invoke('computer:allowed-apps'), launchApp: invoke('computer:launch-app'), openPath: invoke('computer:open-path') }),
  computerUse: Object.freeze({ captureScreen: invoke('computer-use:capture-screen'), inspectAccessibility: invoke('computer-use:inspect-accessibility'), click: invoke('computer-use:click'), typeText: invoke('computer-use:type-text'), pressKey: invoke('computer-use:press-key') }),
  studio: Object.freeze({
    capabilities: invoke('studio:capabilities'), probe: invoke('studio:probe'), extractAudio: invoke('studio:extract-audio'), concat: invoke('studio:concat'),
    ocrStatus: invoke('studio:ocr-status'), ocrImage: invoke('studio:ocr-image'),
    hyperframesStatus: invoke('studio:hyperframes-status'), hyperframesRun: invoke('studio:hyperframes-run')
  }),
  integrations: Object.freeze({
    status: invoke('integrations:status'),
    installTool: invoke('integrations:install-tool'),
    listRepos: invoke('integrations:list-repos'),
    getSkills: invoke('integrations:get-skills'),
    installRepo: invoke('integrations:install-repo'),
    removeRepo: invoke('integrations:remove-repo')
  }),
  voice: Object.freeze({ synthesize: invoke('voice:synthesize') }),
  dialog: Object.freeze({ openFiles: invoke('dialog:open-files'), saveFile: invoke('dialog:save-file'), chooseDirectory: invoke('dialog:choose-directory') })
}));
