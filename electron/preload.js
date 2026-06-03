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

// Also expose basic electron info and admin tools
contextBridge.exposeInMainWorld('electron', {
  ping: () => 'pong',
  isElectron: true,
  // Allow the app to trigger a reconfiguration (clears saved config and shows setup wizard)
  reconfigure: () => ipcRenderer.invoke('reconfigure'),
  // Get saved connection config (for displaying server info to help terminal setup)
  getConfig: () => ipcRenderer.invoke('load-config'),
  // Get local network IPs (so admin can tell terminal operators which IP to use)
  getLocalIps: () => ipcRenderer.invoke('get-local-ips'),
});
