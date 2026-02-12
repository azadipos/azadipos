const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Remove the default menu bar completely
Menu.setApplicationMenu(null);

const isDev = !app.isPackaged;
let mainWindow;
let nextProcess;

// Simple logging
function log(msg) {
  console.log(`[Electron] ${msg}`);
}

// Wait for the Next.js server to respond
function waitForServer(url, timeout = 90000, interval = 1000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.request(url, { method: 'GET', timeout: 3000 }, (res) => {
        log(`Server responded: ${res.statusCode}`);
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          log('Server timeout');
          resolve(false);
        } else {
          setTimeout(check, interval);
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - start > timeout) {
          resolve(false);
        } else {
          setTimeout(check, interval);
        }
      });
      req.end();
    };
    check();
  });
}

// Get the standalone server path
function getStandalonePath() {
  if (isDev) {
    // Development: standalone is in .next/standalone
    return path.join(__dirname, '..', '.next', 'standalone');
  } else {
    // Production: standalone is in resources/standalone (extraResources)
    return path.join(process.resourcesPath, 'standalone');
  }
}

// Start the Next.js standalone server
function startServer() {
  const standalonePath = getStandalonePath();
  const serverFile = path.join(standalonePath, 'server.js');
  
  log(`Standalone path: ${standalonePath}`);
  log(`Server file: ${serverFile}`);
  
  // Check if paths exist
  if (!fs.existsSync(standalonePath)) {
    log(`ERROR: Standalone path does not exist: ${standalonePath}`);
    try {
      log(`Resources path contents: ${fs.readdirSync(process.resourcesPath).join(', ')}`);
    } catch (e) {
      log(`Cannot read resources path: ${e.message}`);
    }
    return null;
  }
  
  log(`Standalone contents: ${fs.readdirSync(standalonePath).join(', ')}`);
  
  if (!fs.existsSync(serverFile)) {
    log(`ERROR: server.js not found at: ${serverFile}`);
    return null;
  }
  
  // Check for .next/static and public folders
  const staticPath = path.join(standalonePath, '.next', 'static');
  const publicPath = path.join(standalonePath, 'public');
  
  log(`Static folder exists: ${fs.existsSync(staticPath)}`);
  log(`Public folder exists: ${fs.existsSync(publicPath)}`);
  
  if (fs.existsSync(path.join(standalonePath, '.next'))) {
    log(`.next contents: ${fs.readdirSync(path.join(standalonePath, '.next')).join(', ')}`);
  }
  
  // Environment variables for the server
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    HOSTNAME: 'localhost',
    NEXT_TELEMETRY_DISABLED: '1'
  };
  
  log('Starting Next.js server...');
  
  // Start the server using Node
  const proc = spawn(process.execPath, [serverFile], {
    cwd: standalonePath,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  
  proc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log(`[Next] ${msg}`);
  });
  
  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log(`[Next ERR] ${msg}`);
  });
  
  proc.on('error', (err) => {
    log(`Server spawn error: ${err.message}`);
  });
  
  proc.on('exit', (code) => {
    log(`Server exited with code: ${code}`);
  });
  
  return proc;
}

// Create the main window
async function createWindow() {
  log('Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  const url = 'http://localhost:3000';
  
  log(`Waiting for server at ${url}...`);
  const ready = await waitForServer(url);
  
  if (ready) {
    log('Loading application...');
    mainWindow.loadURL(url);
  } else {
    log('Server failed to start - showing error');
    mainWindow.loadURL(`data:text/html;charset=utf-8,<!DOCTYPE html>
<html>
<head><title>Azadi POS - Error</title></head>
<body style="margin:0;padding:60px;background:#111827;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center;">
<h1 style="color:#f87171;margin-bottom:20px;">Application Failed to Start</h1>
<p style="color:#9ca3af;margin-bottom:30px;">The server could not be started. Please check the logs or restart.</p>
<button onclick="location.reload()" style="padding:12px 24px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;">
Retry
</button>
</body>
</html>`);
  }
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Open DevTools for debugging - remove this line in final production
    // mainWindow.webContents.openDevTools();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App events
app.on('ready', async () => {
  log(`App ready - Packaged: ${app.isPackaged}`);
  log(`App path: ${app.getAppPath()}`);
  log(`Resources path: ${process.resourcesPath}`);
  log(`Exe path: ${process.execPath}`);
  
  if (!isDev) {
    nextProcess = startServer();
    // Wait for server initialization
    await new Promise(r => setTimeout(r, 3000));
  }
  
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextProcess) {
    log('Killing server process...');
    nextProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
