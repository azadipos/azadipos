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

// Log file path
function getLogPath() {
  return path.join(app.getPath('userData'), 'azadipos.log');
}

// Log function - writes to both console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(logLine.trim());
  try {
    fs.appendFileSync(getLogPath(), logLine);
  } catch (e) {}
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

// Clear saved configuration
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

// Test database connection
async function testDatabaseConnection(connectionString) {
  log(`Testing database connection...`);
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    log('Database connection successful');
    return { success: true };
  } catch (error) {
    log(`Database connection failed: ${error.message}`);
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
  };
  
  try {
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
    
    return { process: proc, error: null };
  } catch (error) {
    log(`Failed to spawn server: ${error.message}`);
    return { process: null, error: error.message };
  }
}

// Show error dialog
function showError(title, message) {
  dialog.showErrorBox(title, message);
}

// Create configuration window
function createConfigWindow() {
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
  });
  
  mainWindow.loadFile(path.join(__dirname, 'config.html'));
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    // If server isn't running and window closes, quit the app
    if (!serverStarted) {
      app.quit();
    }
  });
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

ipcMain.handle('clear-config', async () => {
  clearConfig();
  currentConfig = null;
  return { success: true };
});

ipcMain.handle('start-app', async () => {
  log('start-app IPC called');
  
  if (!currentConfig || !currentConfig.databaseUrl) {
    log('No configuration found');
    return { success: false, error: 'No configuration found. Please configure database settings.' };
  }
  
  // Test database connection first
  log('Testing database connection before starting...');
  const dbTest = await testDatabaseConnection(currentConfig.databaseUrl);
  if (!dbTest.success) {
    log(`Database test failed: ${dbTest.error}`);
    return { success: false, error: `Database connection failed: ${dbTest.error}` };
  }
  
  // Start the server (don't close config window yet!)
  log('Starting server...');
  const serverResult = startServer(currentConfig.databaseUrl);
  
  if (!serverResult.process) {
    log(`Server failed to start: ${serverResult.error}`);
    return { success: false, error: `Failed to start server: ${serverResult.error}` };
  }
  
  serverProcess = serverResult.process;
  
  // Wait for server to be ready
  log('Waiting for server to be ready...');
  const serverReady = await waitForServer('http://127.0.0.1:3000');
  
  if (!serverReady) {
    log('Server failed to become ready');
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    return { success: false, error: 'Server failed to start within 90 seconds. Check your database connection and try again.' };
  }
  
  log('Server is ready, opening main window');
  serverStarted = true;
  
  // NOW close the config window and open main window
  if (mainWindow) {
    mainWindow.close();
  }
  
  createMainWindow();
  return { success: true };
});

// App lifecycle
app.whenReady().then(async () => {
  log('=== AzadiPOS Starting ===');
  log(`App path: ${app.getAppPath()}`);
  log(`User data path: ${app.getPath('userData')}`);
  log(`Is packaged: ${app.isPackaged}`);
  
  // Check for existing config
  currentConfig = loadConfig();
  
  if (currentConfig && currentConfig.databaseUrl) {
    log('Found saved configuration, testing connection...');
    
    // Test saved connection
    const result = await testDatabaseConnection(currentConfig.databaseUrl);
    
    if (result.success) {
      log('Saved connection works, starting server...');
      const serverResult = startServer(currentConfig.databaseUrl);
      
      if (serverResult.process) {
        serverProcess = serverResult.process;
        
        const serverReady = await waitForServer('http://127.0.0.1:3000');
        if (serverReady) {
          serverStarted = true;
          createMainWindow();
          return;
        } else {
          log('Server failed to start, showing config window');
          if (serverProcess) {
            serverProcess.kill();
            serverProcess = null;
          }
        }
      }
    } else {
      log(`Saved connection failed: ${result.error}`);
    }
  }
  
  // Show configuration window
  log('Showing configuration window');
  createConfigWindow();
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
