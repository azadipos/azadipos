const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;
let nextProcess;

// Logging helper
function log(message) {
  console.log(`[Electron ${new Date().toISOString()}] ${message}`);
}

// Wait for server to be ready
function waitForServer(url, timeout = 60000, interval = 500) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tryReq = () => {
      const req = http.request(url, { method: 'GET', timeout: 2000 }, (res) => {
        log(`Server responded with status: ${res.statusCode}`);
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          log('Server timeout - giving up');
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

// Get the path to the standalone server
function getServerPath() {
  if (isDev) {
    // In development, use next dev
    return null;
  }
  
  // In production, find server.js in the packaged app
  // With asar: true, app.getAppPath() returns path to app.asar
  const appPath = app.getAppPath();
  const serverPath = path.join(appPath, '.next', 'standalone', 'server.js');
  
  log(`App path: ${appPath}`);
  log(`Looking for server at: ${serverPath}`);
  
  return serverPath;
}

// Start the Next.js server
function startNextServer() {
  if (isDev) {
    log('Development mode - assuming Next.js dev server is running');
    return null;
  }
  
  const serverPath = getServerPath();
  
  if (!serverPath) {
    log('No server path found');
    return null;
  }
  
  // Check if server.js exists
  try {
    // Note: When using asar, fs.existsSync works on files inside the archive
    if (!fs.existsSync(serverPath)) {
      log(`Server not found at: ${serverPath}`);
      
      // Debug: List what's in the app path
      const appPath = app.getAppPath();
      try {
        const contents = fs.readdirSync(appPath);
        log(`Contents of ${appPath}: ${contents.join(', ')}`);
        
        const nextPath = path.join(appPath, '.next');
        if (fs.existsSync(nextPath)) {
          const nextContents = fs.readdirSync(nextPath);
          log(`Contents of .next: ${nextContents.join(', ')}`);
          
          const standalonePath = path.join(nextPath, 'standalone');
          if (fs.existsSync(standalonePath)) {
            const standaloneContents = fs.readdirSync(standalonePath);
            log(`Contents of .next/standalone: ${standaloneContents.join(', ')}`);
          }
        }
      } catch (e) {
        log(`Error listing directories: ${e.message}`);
      }
      
      return null;
    }
  } catch (e) {
    log(`Error checking server path: ${e.message}`);
  }
  
  log('Starting Next.js standalone server...');
  
  // Set working directory to standalone folder
  const standalonePath = path.dirname(serverPath);
  
  // Environment for the server
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    HOSTNAME: 'localhost'
  };
  
  const proc = spawn(process.execPath, [serverPath], {
    cwd: standalonePath,
    env: env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  proc.stdout.on('data', (data) => {
    log(`[Next.js] ${data.toString().trim()}`);
  });
  
  proc.stderr.on('data', (data) => {
    log(`[Next.js Error] ${data.toString().trim()}`);
  });
  
  proc.on('error', (err) => {
    log(`Failed to start server: ${err.message}`);
  });
  
  proc.on('exit', (code, signal) => {
    log(`Server exited with code ${code}, signal ${signal}`);
  });
  
  return proc;
}

async function createWindow() {
  log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: '#1a1a1a'
  });
  
  const appUrl = 'http://localhost:3000';
  
  log(`Waiting for server at ${appUrl}...`);
  const serverReady = await waitForServer(appUrl);
  
  if (serverReady) {
    log('Server is ready, loading app...');
    mainWindow.loadURL(appUrl);
  } else {
    log('Server failed to start');
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head><title>Azadi POS - Error</title></head>
        <body style="background:#1a1a1a;color:white;font-family:system-ui,sans-serif;padding:40px;text-align:center;">
          <h1 style="color:#ef4444;">Failed to Start Application</h1>
          <p style="color:#9ca3af;margin:20px 0;">The application server could not be started.</p>
          <p style="color:#6b7280;font-size:14px;">Please try restarting the application or contact support.</p>
          <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">
            Retry
          </button>
        </body>
      </html>
    `);
  }
  
  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    mainWindow.show();
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// App lifecycle
app.on('ready', async () => {
  log(`App ready. Packaged: ${app.isPackaged}, Platform: ${process.platform}`);
  
  // Start the Next.js server in production
  if (!isDev) {
    nextProcess = startNextServer();
    
    // Give the server time to initialize
    log('Waiting for server to initialize...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await createWindow();
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log('App quitting...');
  if (nextProcess) {
    log('Terminating Next.js server...');
    nextProcess.kill();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
