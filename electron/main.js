const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const { Client } = require('pg');

// Completely remove menu bar
Menu.setApplicationMenu(null);

const isDev = !app.isPackaged;
let mainWindow = null;
let serverProcess = null;
let serverStarted = false;
let currentConfig = null;

// Config file path
function getConfigPath() {
  return path.join(app.getPath('userData'), 'azadipos-config.json');
}

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Load saved configuration
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

// Save configuration
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

// Get the standalone directory path
function getStandalonePath() {
  if (isDev) {
    return path.join(__dirname, '..', '.next', 'standalone');
  }
  return path.join(process.resourcesPath, 'standalone');
}

// Check if server is responding
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

// Wait for server with timeout
async function waitForServer(url, timeoutMs = 60000) {
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

// Test database connection
async function testDatabaseConnection(connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Start the Next.js server
function startServer(databaseUrl) {
  const standalonePath = getStandalonePath();
  const serverJs = path.join(standalonePath, 'server.js');
  
  log(`Standalone path: ${standalonePath}`);
  log(`Server.js path: ${serverJs}`);
  
  if (!fs.existsSync(standalonePath)) {
    log(`ERROR: Standalone directory not found: ${standalonePath}`);
    return null;
  }
  
  if (!fs.existsSync(serverJs)) {
    log(`ERROR: server.js not found at: ${serverJs}`);
    return null;
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
  };
  
  const proc = spawn('node', [serverJs], {
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
  
  return proc;
}

// Create configuration window
function createConfigWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    title: 'AzadiPOS - Configuration',
  });
  
  mainWindow.loadFile(path.join(__dirname, 'config.html'));
}

// Create main application window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    title: 'AzadiPOS',
  });
  
  mainWindow.loadURL('http://127.0.0.1:3000');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for config window
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

ipcMain.handle('start-app', async () => {
  if (!currentConfig || !currentConfig.databaseUrl) {
    return { success: false, error: 'No configuration' };
  }
  
  // Close config window
  if (mainWindow) {
    mainWindow.close();
  }
  
  // Start server and main window
  serverProcess = startServer(currentConfig.databaseUrl);
  if (!serverProcess) {
    return { success: false, error: 'Failed to start server' };
  }
  
  const serverReady = await waitForServer('http://127.0.0.1:3000');
  if (!serverReady) {
    return { success: false, error: 'Server failed to start' };
  }
  
  serverStarted = true;
  createMainWindow();
  return { success: true };
});

// App lifecycle
app.whenReady().then(async () => {
  log('App starting...');
  
  // Check for existing config
  currentConfig = loadConfig();
  
  if (currentConfig && currentConfig.databaseUrl) {
    // Test saved connection
    log('Testing saved database connection...');
    const result = await testDatabaseConnection(currentConfig.databaseUrl);
    
    if (result.success) {
      log('Database connection successful, starting server...');
      serverProcess = startServer(currentConfig.databaseUrl);
      
      if (serverProcess) {
        const serverReady = await waitForServer('http://127.0.0.1:3000');
        if (serverReady) {
          serverStarted = true;
          createMainWindow();
          return;
        }
      }
    }
    
    log('Saved config failed, showing configuration window...');
  }
  
  // Show configuration window
  createConfigWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
