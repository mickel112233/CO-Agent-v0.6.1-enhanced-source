'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('coAgentPet', Object.freeze({
  sendMessage: text => { if (typeof text === 'string' && text.trim()) ipcRenderer.send('pet:message', text.trim().slice(0, 4000)); },
  close: () => ipcRenderer.send('pet:close'),
  onStatus: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, value) => callback(String(value || '').slice(0, 500));
    ipcRenderer.on('pet:status', listener);
    return () => ipcRenderer.removeListener('pet:status', listener);
  }
}));
