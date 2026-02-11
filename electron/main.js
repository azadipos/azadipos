const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.NODE_ENV !== 'production';
let mainWindow;
let nextProcess;

// Wait for the Next.js server to be ready
function waitForServer(url, timeout = 60000, interval = 500) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tryReq = () => {
      const req = http.request(url, { method: 'HEAD', timeout: 2000 }, (res) => {
        console.log('[Electron] Server ready! Status:', res.statusCode);
        resolve(true);
      });
      req.on('error', (err) => {
        if (Date.now() - start > timeout) {
          console.error('[Electron] Server timeout after', Date.now() - start, 'ms');
          resolve(false);
          return;
        }
        setTimeout(tryReq, interval);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - start > timeout) {
          resolve(false);
          return;
        }
        setTimeout(tryReq, interval);
      });
      req.end();
    };
    tryReq();
  });
}

// Start the Next.js standalone server in production
function startNextServer() {
  // In packaged app, resources are in app.asar or app folder
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname, '..');
  
  // The standalone server is at .next/standalone/server.js
  const serverPath = path.join(appPath, '.next', 'standalone', 'server.js');
  
  console.log('[Electron] App packaged:', app.isPackaged);
  console.log('[Electron] App path:', appPath);
  console.log('[Electron] Server path:', serverPath);
  
  // Check if server.js exists
  const fs = require('fs');
  if (!fs.existsSync(serverPath)) {
    console.error('[Electron] server.js not found at:', serverPath);
    console.error('[Electron] Directory contents:', fs.readdirSync(appPath));
    return null;
  }
  
  // Set environment variables
  const env = Object.assign({}, process.env, {
    NODE_ENV: 'production',
    PORT: '3000',
    HOSTNAME: 'localhost'
  });
  
  console.log('[Electron] Starting Next.js standalone server...');
  
  const proc = spawn('node', [serverPath], {
    cwd: path.join(appPath, '.next', 'standalone'),
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  proc.stdout.on('data', (data) => {
    console.log('[Next.js]', data.toString().trim());
  });
  
  proc.stderr.on('data', (data) => {
    console.error('[Next.js Error]', data.toString().trim());
  });
  
  proc.on('error', (err) => {
    console.error('[Electron] Failed to start Next.js:', err);
  });
  
  proc.on('exit', (code) => {
    console.log('[Electron] Next.js process exited with code:', code);
  });
  
  return proc;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false // Don't show until ready
  });
  
  const appUrl = 'http://localhost:3000';
  
  console.log('[Electron] Waiting for server at:', appUrl);
  const serverReady = await waitForServer(appUrl);
  
  if (serverReady) {
    console.log('[Electron] Loading URL:', appUrl);
    mainWindow.loadURL(appUrl);
  } else {
    console.error('[Electron] Server failed to start, showing error page');
    mainWindow.loadURL(`data:text/html,<html><body style="background:#1a1a1a;color:white;font-family:sans-serif;padding:40px;"><h1>Failed to Start</h1><p>The application server failed to start. Please check logs or restart the application.</p></body></html>`);
  }
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  console.log('[Electron] App ready, isDev:', isDev);
  
  if (!isDev) {
    nextProcess = startNextServer();
    // Give the server a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    console.log('[Electron] Killing Next.js process');
    nextProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
