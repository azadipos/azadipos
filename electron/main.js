const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';
let mainWindow;

async function waitForServer(url, timeout = 30000, interval = 500) {
  const start = Date.now();
  const http = require('http');
  return new Promise((resolve, reject) => {
    const tryReq = () => {
      const req = http.request(url, { method: 'HEAD' }, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
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
  const nextCli = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
  nextProcess = spawn(process.execPath, [nextCli, 'start', '-p', '3000'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env),
    stdio: 'inherit',
    shell: false
  });
  nextProcess.on('error', (err) => console.error('next start error:', err));
}

app.on('ready', () => {
  if (!isDev) startNextInProd();
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
