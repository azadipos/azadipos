const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;
let nextProcess;

// Remove the default menu bar
Menu.setApplicationMenu(null);

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

// Get the base path for the app
function getAppBasePath() {
  if (isDev) {
    return path.join(__dirname, '..');
  }
  
  // In production with asar, app.getAppPath() returns the asar archive path
  // But we need to access files inside it
  return app.getAppPath();
}

// Start the Next.js server
function startNextServer() {
  if (isDev) {
    log('Development mode - assuming Next.js dev server is running externally');
    return null;
  }
  
  const basePath = getAppBasePath();
  const serverPath = path.join(basePath, '.next', 'standalone', 'server.js');
  const standalonePath = path.join(basePath, '.next', 'standalone');
  
  log(`Base path: ${basePath}`);
  log(`Server path: ${serverPath}`);
  log(`Standalone path: ${standalonePath}`);
  
  // Debug: List contents
  try {
    log(`Contents of base path: ${fs.readdirSync(basePath).join(', ')}`);
    
    const nextDir = path.join(basePath, '.next');
    if (fs.existsSync(nextDir)) {
      log(`Contents of .next: ${fs.readdirSync(nextDir).join(', ')}`);
      
      if (fs.existsSync(standalonePath)) {
        log(`Contents of standalone: ${fs.readdirSync(standalonePath).join(', ')}`);
        
        // Check for .next inside standalone
        const standaloneNextDir = path.join(standalonePath, '.next');
        if (fs.existsSync(standaloneNextDir)) {
          log(`Contents of standalone/.next: ${fs.readdirSync(standaloneNextDir).join(', ')}`);
        }
        
        // Check for public inside standalone
        const standalonePublicDir = path.join(standalonePath, 'public');
        if (fs.existsSync(standalonePublicDir)) {
          log(`Contents of standalone/public: ${fs.readdirSync(standalonePublicDir).join(', ')}`);
        }
      }
    }
  } catch (e) {
    log(`Error listing directories: ${e.message}`);
  }
  
  // Check if server.js exists
  if (!fs.existsSync(serverPath)) {
    log(`ERROR: server.js not found at: ${serverPath}`);
    return null;
  }
  
  log('Starting Next.js standalone server...');
  
  // Environment for the server
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    HOSTNAME: 'localhost',
    // Tell Next.js where to find static files
    __NEXT_PRIVATE_STANDALONE_CONFIG: JSON.stringify({
      distDir: '.next'
    })
  };
  
  // Start the server using the same Node executable that's running Electron
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
      nodeIntegration: false,
      devTools: true // Enable devtools for debugging
    },
    show: false,
    backgroundColor: '#111827', // Match our app's dark background
    autoHideMenuBar: true, // Hide menu bar
    frame: true
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
      <!DOCTYPE html>
      <html>
        <head><title>Azadi POS - Error</title></head>
        <body style="background:#111827;color:white;font-family:system-ui,sans-serif;padding:40px;text-align:center;">
          <h1 style="color:#ef4444;">Failed to Start Application</h1>
          <p style="color:#9ca3af;margin:20px 0;">The application server could not be started.</p>
          <p style="color:#6b7280;font-size:14px;">Please check the console (Ctrl+Shift+I) for details.</p>
          <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">
            Retry
          </button>
        </body>
      </html>
    `);
  }
  
  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    log('Window ready to show');
    mainWindow.show();
  });
  
  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Open DevTools automatically for debugging (remove in final production)
  mainWindow.webContents.openDevTools();
}

// App lifecycle
app.on('ready', async () => {
  log(`App ready. Packaged: ${app.isPackaged}, Platform: ${process.platform}`);
  log(`App path: ${app.getAppPath()}`);
  log(`Resource path: ${process.resourcesPath}`);
  log(`Executable path: ${process.execPath}`);
  
  // Start the Next.js server in production
  if (!isDev) {
    nextProcess = startNextServer();
    
    // Give the server time to initialize
    log('Waiting for server to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));
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
