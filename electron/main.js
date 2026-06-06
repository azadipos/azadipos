const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { Client } = require('pg');
const crypto = require('crypto');

// Completely remove menu bar
Menu.setApplicationMenu(null);

const isDev = !app.isPackaged;
let mainWindow = null;
let configWindow = null;  // SEPARATE variable for config window
let splashWindow = null;
let serverProcess = null;
let serverStarted = false;
let currentConfig = null;
let connectionAborted = false;

// PostgreSQL installer URL
const POSTGRES_DOWNLOAD_URL = 'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64.exe';

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

function getSchemaPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'server-setup', 'schema.sql');
  }
  return path.join(process.resourcesPath, 'schema.sql');
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

function generateTerminalId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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
      const config = JSON.parse(data);
      // Ensure parsed fields exist (backwards-compat with configs saved before this change)
      if (config && config.databaseUrl && !config.host) {
        try {
          const url = new URL(config.databaseUrl);
          config.host = url.hostname || 'localhost';
          config.port = url.port || '5432';
          config.username = decodeURIComponent(url.username) || 'postgres';
          config.password = decodeURIComponent(url.password) || '';
          config.dbName = url.pathname.replace(/^\//, '') || 'azadipos';
          log(`Backfilled config fields from URL: host=${config.host}, user=${config.username}, db=${config.dbName}, password=${config.password ? '****' : '(empty)'}`);
          // Re-save with the fields included
          saveConfig(config);
        } catch (e) {
          log(`Failed to backfill config from URL: ${e.message}`);
        }
      }
      return config;
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

// ==================== POSTGRESQL DETECTION & INSTALLATION ====================

function checkPostgresInstalled() {
  return new Promise((resolve) => {
    const commonPaths = [
      'C:\\Program Files\\PostgreSQL',
      'C:\\Program Files (x86)\\PostgreSQL',
    ];
    for (const basePath of commonPaths) {
      if (fs.existsSync(basePath)) {
        try {
          const versions = fs.readdirSync(basePath).filter(f => /^\d+$/.test(f));
          if (versions.length > 0) {
            const latestVersion = versions.sort((a, b) => parseInt(b) - parseInt(a))[0];
            const binPath = path.join(basePath, latestVersion, 'bin');
            if (fs.existsSync(path.join(binPath, 'psql.exe'))) {
              resolve({ installed: true, path: binPath, version: latestVersion });
              return;
            }
          }
        } catch (e) {}
      }
    }
    exec('where psql', (error, stdout) => {
      if (!error && stdout.trim()) {
        resolve({ installed: true, path: path.dirname(stdout.trim().split('\n')[0]), version: 'unknown' });
      } else {
        resolve({ installed: false });
      }
    });
  });
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        downloadFile(response.headers.location, dest, onProgress)
          .then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress && totalSize) onProgress(downloadedSize, totalSize);
      });
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    });
    request.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

function runPostgresInstaller(installerPath, password) {
  return new Promise((resolve, reject) => {
    const args = [
      '--mode', 'unattended',
      '--unattendedmodeui', 'minimal',
      '--superpassword', password,
      '--servicename', 'postgresql',
      '--servicepassword', password,
      '--serverport', '5432',
      '--enable-components', 'server,commandlinetools',
      '--disable-components', 'pgAdmin,stackbuilder',
    ];
    const installer = spawn(installerPath, args, { stdio: 'ignore', detached: false });
    installer.on('error', (error) => reject(new Error(`Failed to run installer: ${error.message}`)));
    installer.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else reject(new Error(`Installer exited with code ${code}`));
    });
  });
}

// ==================== POSTGRESQL LAN CONFIGURATION ====================

function findPostgresDataDir() {
  // Find the PostgreSQL data directory where pg_hba.conf lives
  const commonPaths = [
    'C:\\Program Files\\PostgreSQL',
    'C:\\Program Files (x86)\\PostgreSQL',
  ];
  for (const basePath of commonPaths) {
    if (fs.existsSync(basePath)) {
      try {
        const versions = fs.readdirSync(basePath).filter(f => /^\d+$/.test(f));
        if (versions.length > 0) {
          const latestVersion = versions.sort((a, b) => parseInt(b) - parseInt(a))[0];
          const dataDir = path.join(basePath, latestVersion, 'data');
          if (fs.existsSync(dataDir)) {
            return dataDir;
          }
        }
      } catch (e) {
        log(`Error scanning ${basePath}: ${e.message}`);
      }
    }
  }
  return null;
}

function configurePostgresForLAN() {
  const dataDir = findPostgresDataDir();
  if (!dataDir) {
    log('WARNING: Could not find PostgreSQL data directory for LAN configuration');
    return { success: false, error: 'PostgreSQL data directory not found' };
  }

  const hbaPath = path.join(dataDir, 'pg_hba.conf');
  const confPath = path.join(dataDir, 'postgresql.conf');
  let restartNeeded = false;

  // 1. Update pg_hba.conf to allow LAN connections
  try {
    if (fs.existsSync(hbaPath)) {
      let hba = fs.readFileSync(hbaPath, 'utf8');
      const lanRule = 'host    all             all             0.0.0.0/0               scram-sha-256';
      const lanRuleV6 = 'host    all             all             ::/0                    scram-sha-256';
      // Also accept md5 variant in case older PG version
      const lanRuleMd5 = 'host    all             all             0.0.0.0/0               md5';
      
      if (!hba.includes('0.0.0.0/0')) {
        log('Adding LAN access rules to pg_hba.conf');
        hba += '\n\n# Added by AzadiPOS - Allow LAN connections for POS terminals\n';
        hba += lanRule + '\n';
        hba += lanRuleV6 + '\n';
        fs.writeFileSync(hbaPath, hba);
        restartNeeded = true;
        log('pg_hba.conf updated for LAN access');
      } else {
        log('pg_hba.conf already configured for LAN access');
      }
    } else {
      log(`WARNING: pg_hba.conf not found at ${hbaPath}`);
    }
  } catch (e) {
    log(`Error updating pg_hba.conf: ${e.message}`);
    return { success: false, error: `Failed to update pg_hba.conf: ${e.message}` };
  }

  // 2. Update postgresql.conf to listen on all interfaces
  try {
    if (fs.existsSync(confPath)) {
      let conf = fs.readFileSync(confPath, 'utf8');
      // Check if listen_addresses is already set to '*'
      if (!conf.match(/^\s*listen_addresses\s*=\s*'\*'/m)) {
        log('Setting listen_addresses to * in postgresql.conf');
        // Replace existing listen_addresses line (commented or not)
        if (conf.match(/^#?\s*listen_addresses\s*=/m)) {
          conf = conf.replace(/^#?\s*listen_addresses\s*=.*/m, "listen_addresses = '*'");
        } else {
          conf += "\n\n# Added by AzadiPOS - Listen on all interfaces for POS terminals\nlisten_addresses = '*'\n";
        }
        fs.writeFileSync(confPath, conf);
        restartNeeded = true;
        log('postgresql.conf updated: listen_addresses = *');
      } else {
        log('postgresql.conf already listening on all interfaces');
      }
    } else {
      log(`WARNING: postgresql.conf not found at ${confPath}`);
    }
  } catch (e) {
    log(`Error updating postgresql.conf: ${e.message}`);
    return { success: false, error: `Failed to update postgresql.conf: ${e.message}` };
  }

  // 3. Restart PostgreSQL service if config changed
  if (restartNeeded) {
    try {
      log('Restarting PostgreSQL service to apply LAN config...');
      exec('net stop postgresql && net start postgresql', { timeout: 30000 }, (error) => {
        if (error) {
          // Try alternative service names
          exec('net stop postgresql-x64-16 && net start postgresql-x64-16', { timeout: 30000 }, (err2) => {
            if (err2) {
              log(`PostgreSQL restart warning: ${err2.message}. User may need to restart manually.`);
            } else {
              log('PostgreSQL service restarted successfully (x64-16)');
            }
          });
        } else {
          log('PostgreSQL service restarted successfully');
        }
      });
    } catch (e) {
      log(`Error restarting PostgreSQL: ${e.message}`);
    }
  }

  return { success: true, restartNeeded };
}

async function createDatabaseAndTables(host, port, username, password, dbName) {
  log(`Creating database '${dbName}' on ${host}:${port}...`);
  
  // Connect to 'postgres' to create the database
  const adminClient = new Client({ host, port: parseInt(port), user: username, password, database: 'postgres', connectionTimeoutMillis: 5000 });
  try {
    await adminClient.connect();
    const result = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (result.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      log(`Database '${dbName}' created`);
    } else {
      log(`Database '${dbName}' already exists`);
    }
    await adminClient.end();
  } catch (error) {
    try { await adminClient.end(); } catch (e) {}
    throw error;
  }
  
  // Connect to the new database to create tables
  const dbClient = new Client({ host, port: parseInt(port), user: username, password, database: dbName, connectionTimeoutMillis: 5000 });
  try {
    await dbClient.connect();
    const schemaPath = getSchemaPath();
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await dbClient.query(sql);
      log('Database tables created/verified');
    } else {
      log(`WARNING: schema.sql not found at ${schemaPath}`);
    }
    await dbClient.end();
    return { success: true };
  } catch (error) {
    try { await dbClient.end(); } catch (e) {}
    throw error;
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
    if (isUp) { log('Server is responding!'); return true; }
    await new Promise(r => setTimeout(r, 1000));
  }
  log('Server wait timeout exceeded');
  return false;
}

async function testDatabaseConnection(connectionString, timeoutMs = 5000) {
  log(`Testing database connection...`);
  
  // Parse the connection string manually to ensure all params are properly typed.
  // The pg library can throw "password must be a string" if the URL parser
  // returns a non-string type for purely-numeric passwords like "1234".
  let clientConfig;
  try {
    const url = new URL(connectionString);
    clientConfig = {
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || 5432,
      user: decodeURIComponent(url.username) || 'postgres',
      password: String(decodeURIComponent(url.password) || ''),
      database: url.pathname.replace(/^\//, '') || 'azadipos',
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
    };
    log(`Parsed connection: host=${clientConfig.host}, port=${clientConfig.port}, user=${clientConfig.user}, db=${clientConfig.database}`);
  } catch (parseError) {
    log(`Failed to parse connection string as URL, using raw string: ${parseError.message}`);
    clientConfig = {
      connectionString: String(connectionString),
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
    };
  }
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Connection timed out after 5 seconds. Check that the server IP is correct, PostgreSQL is running, and port 5432 is not blocked by a firewall.')), timeoutMs);
  });
  const connectionPromise = (async () => {
    const client = new Client(clientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      log('Database connection successful');
      return { success: true };
    } catch (error) {
      log(`Database connection failed: ${error.message}`);
      try { await client.end(); } catch (e) {}
      // Provide user-friendly error messages
      let friendlyError = error.message;
      if (error.message.includes('pg_hba.conf')) {
        friendlyError = 'Server rejected the connection. The database is not configured to accept network connections. On the server computer, click "Enable LAN Access for Terminals" in the Server Info panel, or run the app as Administrator.';
      } else if (error.message.includes('ECONNREFUSED')) {
        friendlyError = 'Connection refused. PostgreSQL may not be running on the server, or the IP/port is wrong.';
      } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        friendlyError = 'Connection timed out. Check that: (1) the server IP is correct, (2) both computers are on the same network, (3) Windows Firewall allows port 5432 on the server.';
      } else if (error.message.includes('password')) {
        friendlyError = 'Authentication failed. Check that the password is correct.';
      }
      return { success: false, error: friendlyError };
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
  if (isDev) return 'node';
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
    HOSTNAME: '0.0.0.0',
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

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 450, height: 350, frame: false, transparent: false, resizable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    backgroundColor: '#1a1a2e', show: false,
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });
  splashWindow.on('closed', () => { splashWindow = null; });
  return splashWindow;
}

function createConfigWindow(errorMessage = null) {
  closeSplash();
  
  // Close existing config window if any
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.close();
    configWindow = null;
  }
  
  configWindow = new BrowserWindow({
    width: 850, height: 750,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    autoHideMenuBar: true, title: 'AzadiPOS - Setup', resizable: true, show: false,
  });
  configWindow.loadFile(path.join(__dirname, 'config.html'));
  configWindow.once('ready-to-show', () => {
    if (configWindow && !configWindow.isDestroyed()) {
      configWindow.show();
      if (errorMessage) {
        setTimeout(() => {
          if (configWindow && !configWindow.isDestroyed()) {
            configWindow.webContents.send('startup-error', errorMessage);
          }
        }, 100);
      }
    }
  });
  configWindow.on('closed', () => {
    configWindow = null;
    // Only quit if no main window and server not started
    if (!mainWindow && !serverStarted) app.quit();
  });
}

function createMainWindow() {
  closeSplash();
  
  // Close config window first and wait for it
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.close();
    configWindow = null;
  }
  
  // Create the main POS window
  const win = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true, title: 'AzadiPOS', show: false,
  });
  
  // Assign to mainWindow BEFORE loading URL
  mainWindow = win;
  
  win.loadURL('http://127.0.0.1:3000');
  win.once('ready-to-show', () => {
    // Use the local 'win' reference, NOT mainWindow — avoids race condition
    if (win && !win.isDestroyed()) {
      win.show();
    }
  });
  win.on('closed', () => {
    // Only null out if this is still the current mainWindow
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
}

// ==================== IPC HANDLERS ====================

// Helper to get the active IPC target window (config or main)
function getActiveWindow() {
  if (configWindow && !configWindow.isDestroyed()) return configWindow;
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  return null;
}

// Config handlers
ipcMain.handle('test-connection', async (event, connectionString) => {
  return await testDatabaseConnection(connectionString);
});

ipcMain.handle('save-config', async (event, config) => {
  const success = saveConfig(config);
  if (success) currentConfig = config;
  return { success };
});

ipcMain.handle('load-config', async () => loadConfig());

ipcMain.handle('clear-config', async () => {
  clearConfig();
  currentConfig = null;
  return { success: true };
});

ipcMain.handle('open-log-file', async () => {
  const logPath = getLogPath();
  if (fs.existsSync(logPath)) { shell.openPath(logPath); return { success: true }; }
  return { success: false, error: 'Log file not found' };
});

ipcMain.handle('reconfigure', async () => {
  log('Reconfigure requested from app UI');
  // Stop the running server
  if (serverProcess) {
    log('Killing server process for reconfiguration');
    serverProcess.kill();
    serverProcess = null;
    serverStarted = false;
  }
  // Clear saved config
  clearConfig();
  currentConfig = null;
  // Close main window and show config wizard
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }
  createConfigWindow();
  return { success: true };
});

ipcMain.handle('abort-connection', async () => {
  log('Connection abort requested');
  connectionAborted = true;
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  return { success: true };
});

// PostgreSQL setup handlers
ipcMain.handle('check-postgres', async () => {
  return await checkPostgresInstalled();
});

ipcMain.handle('download-postgres', async (event) => {
  const dest = path.join(app.getPath('downloads'), 'postgresql-installer.exe');
  try {
    await downloadFile(POSTGRES_DOWNLOAD_URL, dest, (downloaded, total) => {
      const percent = Math.round((downloaded / total) * 100);
      const win = getActiveWindow();
      if (win) {
        win.webContents.send('download-progress', { downloaded, total, percent });
      }
    });
    return { success: true, path: dest };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-postgres', async (event, password) => {
  const installerPath = path.join(app.getPath('downloads'), 'postgresql-installer.exe');
  if (!fs.existsSync(installerPath)) {
    return { success: false, error: 'Installer not found. Please download first.' };
  }
  try {
    await runPostgresInstaller(installerPath, password);
    try { fs.unlinkSync(installerPath); } catch (e) {}
    // Auto-configure PostgreSQL for LAN access after fresh install
    log('Configuring PostgreSQL for LAN access after install...');
    const lanResult = configurePostgresForLAN();
    if (!lanResult.success) {
      log(`LAN config warning: ${lanResult.error}`);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('configure-lan-access', async () => {
  log('Manual LAN configuration requested');
  return configurePostgresForLAN();
});

ipcMain.handle('get-local-ips', async () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
});

ipcMain.handle('test-pg-connection', async (event, config) => {
  const { host, port, username, password } = config;
  const client = new Client({ host, port: parseInt(port), user: username, password, database: 'postgres', connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('setup-database', async (event, config) => {
  const { host, port, username, password, dbName } = config;
  try {
    // If this is a server setup (localhost), configure PostgreSQL for LAN access
    if (host === 'localhost' || host === '127.0.0.1') {
      log('Server setup detected, configuring PostgreSQL for LAN access...');
      const lanResult = configurePostgresForLAN();
      if (!lanResult.success) {
        log(`LAN config warning: ${lanResult.error}`);
      }
    }
    const result = await createDatabaseAndTables(host, port, username, password, dbName);
    // Build connection string
    const connectionString = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
    return { success: true, connectionString };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
  // Apply schema updates before starting server
  log('Running schema update...');
  const schemaResult = await runSchemaUpdate(currentConfig.databaseUrl);
  if (!schemaResult.success && !schemaResult.skipped) {
    log(`Schema update warning: ${schemaResult.error}`);
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
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
    return { success: false, error: 'Server failed to start within 60 seconds. Check your database connection and try again.' };
  }
  log('Server is ready, opening main window');
  serverStarted = true;
  createMainWindow();
  return { success: true };
});

// ==================== OFFLINE QUEUE IPC HANDLERS ====================

ipcMain.handle('get-terminal-id', async () => getOrCreateTerminalId());
ipcMain.handle('get-offline-queue', async () => loadOfflineQueue());
ipcMain.handle('add-offline-transaction', async (event, transaction) => addToOfflineQueue(transaction));
ipcMain.handle('remove-offline-transactions', async (event, localIds) => removeFromOfflineQueue(localIds));
ipcMain.handle('get-next-offline-counter', async (event, companyId) => getNextOfflineCounter(companyId));
ipcMain.handle('clear-offline-queue', async () => {
  saveOfflineQueue({ transactions: [], counter: 0 });
  log('Offline queue cleared');
  return { success: true };
});

// ==================== APP STARTUP ====================

async function runSchemaUpdate(databaseUrl) {
  // Run schema.sql on every startup to apply any new columns/tables.
  // All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so this is safe.
  const schemaPath = getSchemaPath();
  if (!fs.existsSync(schemaPath)) {
    log(`Schema file not found at ${schemaPath}, skipping schema update`);
    return { success: true, skipped: true };
  }
  log('Running schema update (idempotent)...');
  // Parse the DATABASE_URL to get connection params
  let url;
  try {
    url = new URL(databaseUrl);
  } catch (e) {
    log(`Failed to parse DATABASE_URL: ${e.message}`);
    return { success: false, error: e.message };
  }
  const dbClient = new Client({
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionTimeoutMillis: 10000,
  });
  try {
    await dbClient.connect();
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await dbClient.query(sql);
    await dbClient.end();
    log('Schema update completed successfully');
    return { success: true };
  } catch (error) {
    log(`Schema update error: ${error.message}`);
    try { await dbClient.end(); } catch (e) {}
    return { success: false, error: error.message };
  }
}

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
  // Apply any schema updates before starting the server
  updateSplashStatus('Updating database schema...');
  const schemaResult = await runSchemaUpdate(currentConfig.databaseUrl);
  if (!schemaResult.success && !schemaResult.skipped) {
    log(`Schema update failed: ${schemaResult.error}`);
    // Non-fatal: log the error but still try to start (the old schema might work)
    log('Continuing despite schema update failure...');
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
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
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
  if (serverProcess) { log('Killing server process'); serverProcess.kill(); }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  log('App quitting');
  if (serverProcess) serverProcess.kill();
});
