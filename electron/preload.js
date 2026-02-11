const { contextBridge } = require('electron');

// Expose a minimal safe API to renderer if needed later
contextBridge.exposeInMainWorld('electron', {
  ping: () => 'pong'
});
