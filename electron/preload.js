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

// Expose hardware APIs for POS operations (print, etc.)
contextBridge.exposeInMainWorld('electronHardware', {
  printSilent: (request) => ipcRenderer.invoke('print-silent', request),
  // Stubs for hardware that may not be connected
  sendPayment: async () => ({ success: true, approved: true }),
  cancelPayment: async () => {},
  openCashDrawer: async () => ({ success: true }),
  readScale: async () => ({ success: false, error: 'No scale connected' }),
  subscribeScale: () => () => {},
  getPrinters: async () => [],
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
  // Configure PostgreSQL for LAN access (updates pg_hba.conf and restarts service)
  configureLanAccess: () => ipcRenderer.invoke('configure-lan-access'),
  // Backup & Restore
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  restoreDatabase: (backupPath) => ipcRenderer.invoke('restore-database', backupPath),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  browseBackupFile: () => ipcRenderer.invoke('browse-backup-file'),
  getAppDataPaths: () => ipcRenderer.invoke('get-app-data-paths'),
  // Open log file
  openLogFile: () => ipcRenderer.invoke('open-log-file'),
  // Check for updates (opens GitHub releases page)
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
});
