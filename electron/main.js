const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const { Client } = require('pg');
const crypto = require('crypto');

// Completely remove menu bar
Menu.setApplicationMenu(null);

const isDev = !app.isPackaged;
let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let serverStarted = false;
let currentConfig = null;
let connectionAborted = false;

// ==================== FILE PATHS ====================

function getConfigPath() {
  return path.join(app.getPath('userData'), 'azadipos-config.json');
}

function getLogPath() {
  return path.join(app.getPath('userData'), 'azadipos.log');
}

function getOfflineQueuePath() {
  return path.join(app.getPath('userData'), 'offline-queue.json');
}

function getTerminalIdPath() {
  return path.join(app.getPath('userData'), 'terminal-id.txt');
}

// ==================== LOGGING ====================

function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(logLine.trim());
  try {
    fs.appendFileSync(getLogPath(), logLine);
  } catch (e) {}
}

// ==================== TERMINAL ID ====================
// Each terminal gets a unique 4-character ID to prevent transaction number conflicts

function generateTerminalId() {
  // Generate a 4-character alphanumeric ID
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking chars
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function getOrCreateTerminalId() {
  const terminalIdPath = getTerminalIdPath();
  try {
    if (fs.existsSync(terminalIdPath)) {
      const id = fs.readFileSync(terminalIdPath, 'utf8').trim();
      if (id.length === 4) {
        log(`Terminal ID loaded: ${id}`);
        return id;
      }
    }
  } catch (e) {
    log(`Error reading terminal ID: ${e.message}`);
  }
  
  // Generate new terminal ID
  const newId = generateTerminalId();
  try {
    fs.writeFileSync(terminalIdPath, newId);
    log(`New terminal ID generated and saved: ${newId}`);
  } catch (e) {
    log(`Error saving terminal ID: ${e.message}`);
  }
  return newId;
}

// ==================== OFFLINE QUEUE STORAGE ====================
// Persistent storage for offline transactions (survives cache clears)

function loadOfflineQueue() {
  try {
    const queuePath = getOfflineQueuePath();
    if (fs.existsSync(queuePath)) {
      const data = fs.readFileSync(queuePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    log(`Error loading offline queue: ${e.message}`);
  }
  return { transactions: [], counter: 0 };
}

function saveOfflineQueue(queue) {
  try {
    const queuePath = getOfflineQueuePath();
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
    return true;
  } catch (e) {
    log(`Error saving offline queue: ${e.message}`);
    return false;
  }
}

function addToOfflineQueue(transaction) {
  const queue = loadOfflineQueue();
  queue.transactions.push(transaction);
  saveOfflineQueue(queue);
  log(`Added transaction to offline queue. Total pending: ${queue.transactions.length}`);
  return queue.transactions.length;
}

function removeFromOfflineQueue(localIds) {
  const queue = loadOfflineQueue();
  queue.transactions = queue.transactions.filter(tx => !localIds.includes(tx.localId));
  saveOfflineQueue(queue);
  log(`Removed ${localIds.length} transactions from offline queue. Remaining: ${queue.transactions.length}`);
  return queue.transactions.length;
}

function getNextOfflineCounter(companyId) {
  const queue = loadOfflineQueue();
  const key = `counter_${companyId}`;
  queue[key] = (queue[key] || 0) + 1;
  saveOfflineQueue(queue);
  return queue[key];
}

// ==================== CONFIG MANAGEMENT ====================

function loadConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading config: ${error.message}`);
  }
  return null;
}

function saveConfig(config) {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    log(`Error saving config: ${error.message}`);
    return false;
  }
}

function clearConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    log(`Error clearing config: ${error.message}`);
  }
}

// ==================== SERVER MANAGEMENT ====================

function getStandalonePath() {
  if (isDev) {
    return path.join(__dirname, '..', '.next', 'standalone');
  }
  return path.join(process.resourcesPath, 'standalone');
}

function checkServer(url) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function waitForServer(url, timeoutMs = 90000) {
  const startTime = Date.now();
  log(`Waiting for server at ${url}...`);
  
  while (Date.now() - startTime < timeoutMs) {
    const isUp = await checkServer(url);
    if (isUp) {
      log('Server is responding!');
      return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  log('Server wait timeout exceeded');
  return false;
}

async function testDatabaseConnection(connectionString, timeoutMs = 5000) {
  log(`Testing database connection...`);
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Connection timed out after 5 seconds')), timeoutMs);
  });
  
  const connectionPromise = (async () => {
    const client = new Client({ 
      connectionString, 
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      log('Database connection successful');
      return { success: true };
    } catch (error) {
      log(`Database connection failed: ${error.message}`);
      try { await client.end(); } catch (e) {}
      return { success: false, error: error.message };
    }
  })();
  
  try {
    return await Promise.race([connectionPromise, timeoutPromise]);
  } catch (error) {
    log(`Database connection timed out: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function getNodePath() {
  if (isDev) {
    return 'node';
  }
  return process.execPath;
}

function startServer(databaseUrl) {
  const standalonePath = getStandalonePath();
  const serverJs = path.join(standalonePath, 'server.js');
  
  log(`Standalone path: ${standalonePath}`);
  log(`Server.js path: ${serverJs}`);
  
  if (!fs.existsSync(standalonePath)) {
    log(`ERROR: Standalone directory not found: ${standalonePath}`);
    return { process: null, error: `Standalone directory not found: ${standalonePath}` };
  }
  
  if (!fs.existsSync(serverJs)) {
    log(`ERROR: server.js not found at: ${serverJs}`);
    return { process: null, error: `server.js not found` };
  }
  
  log('Starting Next.js server...');
  
  const env = {
    ...process.env,
    PORT: '3000',
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    DATABASE_URL: databaseUrl,
    NEXTAUTH_URL: 'http://127.0.0.1:3000',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'azadipos-desktop-secret-key-change-in-production',
    ELECTRON_RUN_AS_NODE: '1',
  };
  
  const nodePath = getNodePath();
  log(`Using Node.js at: ${nodePath}`);
  
  try {
    const proc = spawn(nodePath, [serverJs], {
      cwd: standalonePath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    proc.stdout.on('data', (data) => log(`[Server] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => log(`[Server Error] ${data.toString().trim()}`));
    proc.on('error', (error) => log(`[Server Process Error] ${error.message}`));
    proc.on('close', (code) => {
      log(`Server process exited with code ${code}`);
      serverProcess = null;
      serverStarted = false;
    });
    
    return { process: proc, error: null };
  } catch (error) {
    log(`Failed to spawn server: ${error.message}`);
    return { process: null, error: error.message };
  }
}

// ==================== WINDOW MANAGEMENT ====================

function updateSplashStatus(status, isError = false) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', { status, isError });
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 450,
    height: 350,
    frame: false,
    transparent: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#1a1a2e',
    show: false,
  });
  
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
  
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
  
  return splashWindow;
}

function createConfigWindow(errorMessage = null) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  
  mainWindow = new BrowserWindow({
    width: 650,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    title: 'AzadiPOS - Configuration',
    resizable: true,
    show: false,
  });
  
  mainWindow.loadFile(path.join(__dirname, 'config.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (errorMessage) {
      setTimeout(() => {
        mainWindow.webContents.send('startup-error', errorMessage);
      }, 100);
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!serverStarted) {
      app.quit();
    }
  });
}

function createMainWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    title: 'AzadiPOS',
    show: false,
  });
  
  mainWindow.loadURL('http://127.0.0.1:3000');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==================== IPC HANDLERS ====================

// Config handlers
ipcMain.handle('test-connection', async (event, connectionString) => {
  return await testDatabaseConnection(connectionString);
});

ipcMain.handle('save-config', async (event, config) => {
  const success = saveConfig(config);
  if (success) {
    currentConfig = config;
  }
  return { success };
});

ipcMain.handle('load-config', async () => {
  return loadConfig();
});

ipcMain.handle('clear-config', async () => {
  clearConfig();
  currentConfig = null;
  return { success: true };
});

ipcMain.handle('open-log-file', async () => {
  const logPath = getLogPath();
  if (fs.existsSync(logPath)) {
    shell.openPath(logPath);
    return { success: true };
  }
  return { success: false, error: 'Log file not found' };
});

ipcMain.handle('abort-connection', async () => {
  log('Connection abort requested');
  connectionAborted = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  return { success: true };
});

ipcMain.handle('start-app', async () => {
  log('start-app IPC called');
  connectionAborted = false;
  
  if (!currentConfig || !currentConfig.databaseUrl) {
    log('No configuration found');
    return { success: false, error: 'No configuration found. Please configure database settings.' };
  }
  
  log('Testing database connection before starting...');
  const dbTest = await testDatabaseConnection(currentConfig.databaseUrl);
  
  if (connectionAborted) {
    log('Connection aborted by user');
    return { success: false, error: 'Connection cancelled', aborted: true };
  }
  
  if (!dbTest.success) {
    log(`Database test failed: ${dbTest.error}`);
    return { success: false, error: `Database connection failed: ${dbTest.error}` };
  }
  
  log('Starting server...');
  const serverResult = startServer(currentConfig.databaseUrl);
  
  if (connectionAborted) {
    if (serverResult.process) serverResult.process.kill();
    return { success: false, error: 'Connection cancelled', aborted: true };
  }
  
  if (!serverResult.process) {
    log(`Server failed to start: ${serverResult.error}`);
    return { success: false, error: `Failed to start server: ${serverResult.error}` };
  }
  
  serverProcess = serverResult.process;
  
  log('Waiting for server to be ready...');
  const serverReady = await waitForServer('http://127.0.0.1:3000', 60000);
  
  if (connectionAborted) {
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
    return { success: false, error: 'Connection cancelled', aborted: true };
  }
  
  if (!serverReady) {
    log('Server failed to become ready');
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    return { success: false, error: 'Server failed to start within 60 seconds. Check your database connection and try again.' };
  }
  
  log('Server is ready, opening main window');
  serverStarted = true;
  
  if (mainWindow) {
    mainWindow.close();
  }
  
  createMainWindow();
  return { success: true };
});

// ==================== OFFLINE QUEUE IPC HANDLERS ====================

ipcMain.handle('get-terminal-id', async () => {
  return getOrCreateTerminalId();
});

ipcMain.handle('get-offline-queue', async () => {
  return loadOfflineQueue();
});

ipcMain.handle('add-offline-transaction', async (event, transaction) => {
  return addToOfflineQueue(transaction);
});

ipcMain.handle('remove-offline-transactions', async (event, localIds) => {
  return removeFromOfflineQueue(localIds);
});

ipcMain.handle('get-next-offline-counter', async (event, companyId) => {
  return getNextOfflineCounter(companyId);
});

ipcMain.handle('clear-offline-queue', async () => {
  saveOfflineQueue({ transactions: [], counter: 0 });
  log('Offline queue cleared');
  return { success: true };
});

// ==================== APP STARTUP ====================

async function attemptAutoStart() {
  log('Attempting auto-start with saved configuration...');
  connectionAborted = false;
  
  updateSplashStatus('Checking saved configuration...');
  await new Promise(r => setTimeout(r, 300));
  
  currentConfig = loadConfig();
  
  if (!currentConfig || !currentConfig.databaseUrl) {
    log('No saved configuration found');
    createConfigWindow();
    return;
  }
  
  updateSplashStatus('Testing database connection...');
  
  const result = await testDatabaseConnection(currentConfig.databaseUrl, 5000);
  
  if (!result.success) {
    log(`Saved connection failed: ${result.error}`);
    updateSplashStatus('Connection failed...', true);
    await new Promise(r => setTimeout(r, 800));
    createConfigWindow(`Previous connection failed: ${result.error}`);
    return;
  }
  
  updateSplashStatus('Starting POS server...');
  log('Saved connection works, starting server...');
  
  const serverResult = startServer(currentConfig.databaseUrl);
  
  if (!serverResult.process) {
    log(`Server failed to start: ${serverResult.error}`);
    updateSplashStatus('Server failed to start...', true);
    await new Promise(r => setTimeout(r, 800));
    createConfigWindow(`Failed to start server: ${serverResult.error}`);
    return;
  }
  
  serverProcess = serverResult.process;
  
  updateSplashStatus('Waiting for server to be ready...');
  const serverReady = await waitForServer('http://127.0.0.1:3000', 45000);
  
  if (!serverReady) {
    log('Server failed to start, showing config window');
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    updateSplashStatus('Server timeout...', true);
    await new Promise(r => setTimeout(r, 800));
    createConfigWindow('Server failed to start within 45 seconds. Please check your database connection.');
    return;
  }
  
  updateSplashStatus('Loading AzadiPOS...');
  serverStarted = true;
  createMainWindow();
}

// ==================== APP LIFECYCLE ====================

app.whenReady().then(async () => {
  log('=== AzadiPOS Starting ===');
  log(`App path: ${app.getAppPath()}`);
  log(`User data path: ${app.getPath('userData')}`);
  log(`Is packaged: ${app.isPackaged}`);
  log(`Terminal ID: ${getOrCreateTerminalId()}`);
  
  createSplashWindow();
  await new Promise(r => setTimeout(r, 300));
  await attemptAutoStart();
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (serverProcess) {
    log('Killing server process');
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log('App quitting');
  if (serverProcess) {
    serverProcess.kill();
  }
});
