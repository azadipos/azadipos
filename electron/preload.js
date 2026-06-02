const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process for offline storage
contextBridge.exposeInMainWorld('electronStore', {
  // Terminal identification
  getTerminalId: () => ipcRenderer.invoke('get-terminal-id'),
  
  // Offline queue management
  getOfflineQueue: () => ipcRenderer.invoke('get-offline-queue'),
  addOfflineTransaction: (transaction) => ipcRenderer.invoke('add-offline-transaction', transaction),
  removeOfflineTransactions: (localIds) => ipcRenderer.invoke('remove-offline-transactions', localIds),
  getNextOfflineCounter: (companyId) => ipcRenderer.invoke('get-next-offline-counter', companyId),
  clearOfflineQueue: () => ipcRenderer.invoke('clear-offline-queue'),
  
  // Check if running in Electron
  isElectron: true,
});

// Also expose basic electron info
contextBridge.exposeInMainWorld('electron', {
  ping: () => 'pong',
  isElectron: true,
});
