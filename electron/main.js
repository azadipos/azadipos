const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Completely remove menu bar
Menu.setApplicationMenu(null);

const isDev = !app.isPackaged;
let mainWindow = null;
let serverProcess = null;
let serverStarted = false;

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Get the standalone directory path
function getStandalonePath() {
  if (isDev) {
    return path.join(__dirname, '..', '.next', 'standalone');
  }
  // In production, extraResources puts it in resources/standalone
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

// Start the Next.js server
function startServer() {
  const standalonePath = getStandalonePath();
  const serverJs = path.join(standalonePath, 'server.js');
  const envFile = path.join(standalonePath, '.env');
  
  log(`Standalone path: ${standalonePath}`);
  log(`Server.js path: ${serverJs}`);
  log(`Env file path: ${envFile}`);
  
  // Verify standalone directory exists
  if (!fs.existsSync(standalonePath)) {
    log(`ERROR: Standalone directory not found: ${standalonePath}`);
    log(`Resources path: ${process.resourcesPath}`);
    try {
      log(`Resources contents: ${fs.readdirSync(process.resourcesPath).join(', ')}`);
    } catch (e) {
      log(`Cannot read resources: ${e.message}`);
    }
    return null;
  }
  
  // List standalone contents
  try {
    log(`Standalone contents: ${fs.readdirSync(standalonePath).join(', ')}`);
  } catch (e) {
    log(`Cannot read standalone: ${e.message}`);
  }
  
  // Verify server.js exists
  if (!fs.existsSync(serverJs)) {
    log(`ERROR: server.js not found at: ${serverJs}`);
    return null;
  }
  
  // Verify .env exists
  if (!fs.existsSync(envFile)) {
    log(`WARNING: .env file not found at: ${envFile}`);
  } else {
    log('.env file found');
  }
  
  // Check for .next/static
  const staticPath = path.join(standalonePath, '.next', 'static');
  if (fs.existsSync(staticPath)) {
    log('.next/static folder found');
  } else {
    log('WARNING: .next/static folder not found');
  }
  
  // Check for public folder
  const publicPath = path.join(standalonePath, 'public');
  if (fs.existsSync(publicPath)) {
    log('public folder found');
  } else {
    log('WARNING: public folder not found');
  }
  
  log('Starting Next.js server...');
  
  // Environment for the server
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    HOSTNAME: 'localhost',
    NEXT_TELEMETRY_DISABLED: '1'
  };
  
  // Start server
  const proc = spawn(process.execPath, [serverJs], {
    cwd: standalonePath,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  
  proc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      log(`[Server] ${msg}`);
      if (msg.includes('Ready') || msg.includes('started') || msg.includes('localhost:3000')) {
        serverStarted = true;
      }
    }
  });
  
  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log(`[Server Error] ${msg}`);
  });
  
  proc.on('error', (err) => {
    log(`Server spawn error: ${err.message}`);
  });
  
  proc.on('exit', (code, signal) => {
    log(`Server exited - code: ${code}, signal: ${signal}`);
    serverStarted = false;
  });
  
  return proc;
}

// Create the main window
async function createWindow() {
  log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });
  
  // Handle page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log(`Page load failed: ${errorCode} - ${errorDescription}`);
  });
  
  const serverUrl = 'http://localhost:3000';
  const serverReady = await waitForServer(serverUrl);
  
  if (serverReady) {
    log('Loading application from server...');
    mainWindow.loadURL(serverUrl);
  } else {
    log('Server not ready - showing error page');
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Azadi POS - Connection Error</title>
        <style>
          body {
            margin: 0;
            padding: 60px;
            background: #111827;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
          }
          h1 { color: #f87171; margin-bottom: 20px; }
          p { color: #9ca3af; margin-bottom: 15px; }
          button {
            padding: 12px 24px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
          }
          button:hover { background: #2563eb; }
          .details { 
            margin-top: 30px;
            padding: 20px;
            background: #1f2937;
            border-radius: 8px;
            text-align: left;
            font-family: monospace;
            font-size: 12px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <h1>Unable to Start Application</h1>
        <p>The application server could not be started.</p>
        <p>Please ensure you have an internet connection and try again.</p>
        <button onclick="location.reload()">Retry</button>
        <div class="details">
          <p>If the problem persists:</p>
          <p>1. Check your internet connection</p>
          <p>2. Restart the application</p>
          <p>3. Contact support if issues continue</p>
        </div>
      </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
  }
  
  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready
app.on('ready', async () => {
  log('='.repeat(50));
  log('AZADI POS STARTING');
  log('='.repeat(50));
  log(`Packaged: ${app.isPackaged}`);
  log(`App path: ${app.getAppPath()}`);
  log(`Resources path: ${process.resourcesPath}`);
  log(`User data: ${app.getPath('userData')}`);
  log(`Executable: ${process.execPath}`);
  log('='.repeat(50));
  
  if (!isDev) {
    serverProcess = startServer();
    // Give server time to initialize
    await new Promise(r => setTimeout(r, 3000));
  }
  
  await createWindow();
});

// Window management
app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log('App quitting - cleaning up...');
  if (serverProcess) {
    log('Terminating server process');
    serverProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`);
  log(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection: ${reason}`);
});
