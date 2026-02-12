const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const { Client } = require('pg');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
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

// Check if PostgreSQL is installed
ipcMain.handle('check-postgres', async () => {
  return new Promise((resolve) => {
    exec('psql --version', (error, stdout) => {
      if (error) {
        resolve({ installed: false, version: null });
      } else {
        resolve({ installed: true, version: stdout.trim() });
      }
    });
  });
});

// Test PostgreSQL connection
ipcMain.handle('test-connection', async (event, config) => {
  const { host, port, username, password } = config;
  const client = new Client({
    host,
    port: parseInt(port),
    user: username,
    password,
    database: 'postgres', // Connect to default DB first
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

// Run migrations
ipcMain.handle('run-migrations', async (event, config) => {
  const { host, port, username, password, dbName } = config;
  const connectionString = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
  
  // Find prisma directory
  let prismaDir;
  if (app.isPackaged) {
    prismaDir = path.join(process.resourcesPath, 'prisma');
  } else {
    prismaDir = path.join(__dirname, '..', 'prisma');
  }
  
  return new Promise((resolve) => {
    const env = { ...process.env, DATABASE_URL: connectionString };
    
    // First generate Prisma client, then push schema
    exec(`npx prisma db push --schema="${path.join(prismaDir, 'schema.prisma')}"`, 
      { env, cwd: __dirname },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      }
    );
  });
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
