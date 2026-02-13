const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const os = require('os');
const https = require('https');
const { spawn, exec } = require('child_process');

let mainWindow;

// PostgreSQL installer URL (latest stable version for Windows x64)
const POSTGRES_DOWNLOAD_URL = 'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64.exe';
const POSTGRES_INSTALLER_NAME = 'postgresql-installer.exe';

// Get downloads folder
function getDownloadPath() {
  return path.join(app.getPath('downloads'), POSTGRES_INSTALLER_NAME);
}

// Read SQL schema file
function getSchemaSQL() {
  let schemaPath;
  if (app.isPackaged) {
    schemaPath = path.join(process.resourcesPath, 'schema.sql');
  } else {
    schemaPath = path.join(__dirname, 'schema.sql');
  }
  return fs.readFileSync(schemaPath, 'utf8');
}

// Check if PostgreSQL is installed
function checkPostgresInstalled() {
  return new Promise((resolve) => {
    // Check common installation paths
    const commonPaths = [
      'C:\\Program Files\\PostgreSQL',
      'C:\\Program Files (x86)\\PostgreSQL',
    ];
    
    for (const basePath of commonPaths) {
      if (fs.existsSync(basePath)) {
        const versions = fs.readdirSync(basePath).filter(f => /^\d+$/.test(f));
        if (versions.length > 0) {
          const latestVersion = versions.sort((a, b) => parseInt(b) - parseInt(a))[0];
          const binPath = path.join(basePath, latestVersion, 'bin');
          if (fs.existsSync(path.join(binPath, 'psql.exe'))) {
            resolve({ installed: true, path: binPath, version: latestVersion });
            return;
          }
        }
      }
    }
    
    // Try to run psql command
    exec('where psql', (error, stdout) => {
      if (!error && stdout.trim()) {
        resolve({ installed: true, path: path.dirname(stdout.trim().split('\n')[0]), version: 'unknown' });
      } else {
        resolve({ installed: false });
      }
    });
  });
}

// Download file with progress
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location, dest, onProgress)
          .then(resolve)
          .catch(reject);
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
        if (onProgress && totalSize) {
          onProgress(downloadedSize, totalSize);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Run PostgreSQL installer silently
function runInstaller(installerPath, password) {
  return new Promise((resolve, reject) => {
    // PostgreSQL silent install arguments
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
    
    const installer = spawn(installerPath, args, {
      stdio: 'ignore',
      detached: false,
    });
    
    installer.on('error', (error) => {
      reject(new Error(`Failed to run installer: ${error.message}`));
    });
    
    installer.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Installer exited with code ${code}`));
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    title: 'AzadiPOS Server Setup',
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Check if PostgreSQL is installed
ipcMain.handle('check-postgres', async () => {
  return await checkPostgresInstalled();
});

// Download PostgreSQL installer
ipcMain.handle('download-postgres', async (event) => {
  const dest = getDownloadPath();
  
  try {
    await downloadFile(POSTGRES_DOWNLOAD_URL, dest, (downloaded, total) => {
      const percent = Math.round((downloaded / total) * 100);
      mainWindow.webContents.send('download-progress', { downloaded, total, percent });
    });
    return { success: true, path: dest };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Install PostgreSQL
ipcMain.handle('install-postgres', async (event, password) => {
  const installerPath = getDownloadPath();
  
  if (!fs.existsSync(installerPath)) {
    return { success: false, error: 'Installer not found. Please download first.' };
  }
  
  try {
    await runInstaller(installerPath, password);
    
    // Clean up installer
    try {
      fs.unlinkSync(installerPath);
    } catch (e) {}
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open download folder
ipcMain.handle('open-downloads-folder', async () => {
  shell.openPath(app.getPath('downloads'));
});

// Get local IP addresses
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

// Test PostgreSQL connection
ipcMain.handle('test-connection', async (event, config) => {
  const { host, port, username, password } = config;
  const client = new Client({
    host,
    port: parseInt(port),
    user: username,
    password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create database
ipcMain.handle('create-database', async (event, config) => {
  const { host, port, username, password, dbName } = config;
  const client = new Client({
    host,
    port: parseInt(port),
    user: username,
    password,
    database: 'postgres',
  });

  try {
    await client.connect();
    
    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (result.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
    
    await client.end();
    return { success: true, created: result.rows.length === 0 };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Setup tables using raw SQL
ipcMain.handle('setup-tables', async (event, config) => {
  const { host, port, username, password, dbName } = config;
  const client = new Client({
    host,
    port: parseInt(port),
    user: username,
    password,
    database: dbName,
  });

  try {
    await client.connect();
    
    // Get the SQL schema
    const sql = getSchemaSQL();
    
    // Execute the SQL
    await client.query(sql);
    
    await client.end();
    return { success: true };
  } catch (error) {
    await client.end().catch(() => {});
    return { success: false, error: error.message };
  }
});

// Generate connection string
ipcMain.handle('generate-connection-string', async (event, config) => {
  const { host, port, username, password, dbName } = config;
  return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
});

// Save config to file
ipcMain.handle('save-config', async (event, config) => {
  const configPath = path.join(app.getPath('userData'), 'server-config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true, path: configPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Load config from file
ipcMain.handle('load-config', async () => {
  const configPath = path.join(app.getPath('userData'), 'server-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return { success: true, config: JSON.parse(data) };
    }
    return { success: false, error: 'No config found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
