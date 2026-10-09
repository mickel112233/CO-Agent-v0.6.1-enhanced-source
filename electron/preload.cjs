const { contextBridge } = require('electron');

// Intentionally exposes only safe, read-only desktop metadata.
// Privileged automation, file operations and model IPC must be added as
// explicit allow-listed methods before being used by the renderer.
contextBridge.exposeInMainWorld('coAgent', Object.freeze({
  app: Object.freeze({ name: 'CO-Agent', version: '0.6.1' }),
  platform: process.platform,
  capabilities: Object.freeze({
    localRuntime: false,
    computerUse: false,
    mediaPipeline: false
  })
}));
