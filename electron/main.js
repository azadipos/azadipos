const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';
let mainWindow;

async function waitForServer(url, timeout = 60000, interval = 500) {
  const start = Date.now();
  const http = require('http');
  return new Promise((resolve, reject) => {
    const tryReq = () => {
      const req = http.request(url, { method: 'HEAD' }, (res) => {
        console.log('[Electron] Server ready!');
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          console.error('[Electron] Server timeout after', Date.now() - start, 'ms');
          return resolve(false);
        }
        setTimeout(tryReq, interval);
      });
      req.end();
    };
    tryReq();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const appUrl = 'http://localhost:3000';
  try {
    await waitForServer(appUrl);
    mainWindow.loadURL(appUrl);
  } catch (err) {
    // fallback: still try to load URL
    mainWindow.loadURL(appUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// In production, start the Next.js server bundled with the app
let nextProcess;
function startNextInProd() {
  const { spawn } = require('child_process');
  const appDir = path.join(__dirname, '..');
  const nextCmd = process.platform === 'win32' 
    ? path.join(appDir, 'node_modules', '.bin', 'next.cmd')
    : path.join(appDir, 'node_modules', '.bin', 'next');
  
  console.log('[Electron] Starting Next.js from:', nextCmd);
  
  nextProcess = spawn(nextCmd, ['start', '-p', '3000'], {
    cwd: appDir,
    env: Object.assign({}, process.env, { NODE_ENV: 'production' }),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });

  nextProcess.stdout.on('data', (data) => console.log('[Next]', data.toString().trim()));
  nextProcess.stderr.on('data', (data) => console.error('[Next Error]', data.toString().trim()));
  nextProcess.on('error', (err) => console.error('[Electron] Next spawn error:', err));
}

app.on('ready', async () => {
  if (!isDev) startNextInProd();
  await new Promise(resolve => setTimeout(resolve, 2000));
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextProcess) nextProcess.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
