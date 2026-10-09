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
  studio: Object.freeze({ capabilities: invoke('studio:capabilities'), probe: invoke('studio:probe'), extractAudio: invoke('studio:extract-audio'), concat: invoke('studio:concat') }),
  voice: Object.freeze({ synthesize: invoke('voice:synthesize') }),
  dialog: Object.freeze({ openFiles: invoke('dialog:open-files'), saveFile: invoke('dialog:save-file'), chooseDirectory: invoke('dialog:choose-directory') })
}));
