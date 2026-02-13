const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const os = require('os');

let mainWindow;

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
