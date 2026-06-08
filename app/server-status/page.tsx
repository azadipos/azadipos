"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Monitor,
  Wifi,
  WifiOff,
  Clock,
  HardDrive,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  User,
  ArrowUpCircle,
  Database,
  Copy,
  Eye,
  EyeOff,
  Network,
  Download,
  FolderArchive,
  Upload,
  FolderOpen,
  FileText,
  Loader2,
} from "lucide-react";

interface TerminalInfo {
  terminalId: string;
  name: string;
  ip: string;
  status: string;
  lastSeen: number;
  lastSeenAgo: number;
  isOnline: boolean;
  shiftOpen: boolean;
  employeeName?: string;
  version?: string;
}

interface ServerInfo {
  status: string;
  version: string;
  uptime: string;
  uptimeSeconds: number;
  hostname: string;
  platform: string;
  memoryUsage: {
    totalMB: number;
    freeMB: number;
    usedMB: number;
    totalGB: string;
  };
  lanIPs: string[];
  connectionInfo: {
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
    connectionString: string;
  } | null;
  nodeVersion: string;
  serverTime: string;
}

interface HeartbeatData {
  serverTime: string;
  terminalCount: number;
  onlineCount: number;
  terminals: TerminalInfo[];
}

export default function ServerStatusPage() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [heartbeatData, setHeartbeatData] = useState<HeartbeatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [backing, setBacking] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [serverRes, heartbeatRes] = await Promise.all([
        fetch("/api/system/server-info"),
        fetch("/api/system/heartbeat"),
      ]);

      if (serverRes.ok) {
        setServerInfo(await serverRes.json());
      }
      if (heartbeatRes.ok) {
        setHeartbeatData(await heartbeatRes.json());
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError("Unable to connect to server");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    const electronAvailable = !!(window as any).electron?.isElectron;
    setIsElectron(electronAvailable);
    if (electronAvailable) {
      (window as any).electron?.listBackups?.().then((b: any[]) => setBackups(b || []));
    }
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatLastSeen = (seconds: number) => {
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const memPercent = serverInfo
    ? Math.round((serverInfo.memoryUsage.usedMB / serverInfo.memoryUsage.totalMB) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-7 w-7 text-blue-500" />
            <div>
              <h1 className="text-xl font-bold">AzadiPOS Server</h1>
              <p className="text-sm text-gray-400">System Status Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastRefresh && (
              <span className="text-xs text-gray-500">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Server Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-lg ${serverInfo ? "bg-green-500/20" : "bg-red-500/20"}`}>
              <Activity className={`h-5 w-5 ${serverInfo ? "text-green-400" : "text-red-400"}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Server Status</h2>
              <p className={`text-sm ${serverInfo ? "text-green-400" : "text-red-400"}`}>
                {serverInfo ? "Running" : "Offline"}
              </p>
            </div>
            {serverInfo && (
              <div className="ml-auto flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-sm text-green-400 font-medium">Online</span>
              </div>
            )}
          </div>

          {serverInfo && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <ArrowUpCircle className="h-4 w-4" />
                  Version
                </div>
                <p className="text-lg font-semibold">{serverInfo.version}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Clock className="h-4 w-4" />
                  Uptime
                </div>
                <p className="text-lg font-semibold">{formatUptime(serverInfo.uptimeSeconds)}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <HardDrive className="h-4 w-4" />
                  System RAM
                </div>
                <p className="text-lg font-semibold">
                  {(serverInfo.memoryUsage.usedMB / 1024).toFixed(1)} / {serverInfo.memoryUsage.totalGB} GB
                </p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      memPercent > 80 ? "bg-red-500" : memPercent > 60 ? "bg-yellow-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${memPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{memPercent}% used</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Network className="h-4 w-4" />
                  Server IP
                </div>
                {serverInfo.lanIPs.length > 0 ? (
                  serverInfo.lanIPs.map((ip) => (
                    <p key={ip} className="text-lg font-semibold">{ip}</p>
                  ))
                ) : (
                  <p className="text-lg font-semibold text-gray-500">No LAN</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Connection Info for Terminals */}
        {serverInfo?.connectionInfo && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Database className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Connection Info</h2>
                <p className="text-sm text-gray-400">Use these credentials when setting up new terminals</p>
              </div>
            </div>

            {/* Connection String */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Connection String</label>
              <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-3">
                <code className="text-sm text-green-400 flex-1 break-all font-mono">
                  {showPassword
                    ? serverInfo.connectionInfo.connectionString
                    : serverInfo.connectionInfo.connectionString.replace(
                        `:${serverInfo.connectionInfo.password}@`,
                        ":****@"
                      )}
                </code>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors flex-shrink-0"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </button>
                <button
                  onClick={() => copyToClipboard(serverInfo.connectionInfo!.connectionString, "connStr")}
                  className="p-1.5 rounded hover:bg-gray-700 transition-colors flex-shrink-0"
                  title="Copy"
                >
                  {copied === "connStr" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Individual Fields */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Host", value: serverInfo.lanIPs[0] || serverInfo.connectionInfo.host, key: "host" },
                { label: "Port", value: serverInfo.connectionInfo.port, key: "port" },
                { label: "Database", value: serverInfo.connectionInfo.database, key: "db" },
                { label: "Username", value: serverInfo.connectionInfo.username, key: "user" },
              ].map((field) => (
                <div key={field.key} className="bg-gray-800/50 rounded-lg p-3">
                  <label className="text-xs text-gray-500 block mb-1">{field.label}</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-white">{field.value}</span>
                    <button
                      onClick={() => copyToClipboard(field.value, field.key)}
                      className="p-1 rounded hover:bg-gray-700 transition-colors"
                    >
                      {copied === field.key ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Password field separate with show/hide */}
            <div className="mt-3 bg-gray-800/50 rounded-lg p-3">
              <label className="text-xs text-gray-500 block mb-1">Password</label>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-white">
                  {showPassword ? serverInfo.connectionInfo.password : "••••••••"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 rounded hover:bg-gray-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5 text-gray-500" /> : <Eye className="h-3.5 w-3.5 text-gray-500" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(serverInfo.connectionInfo!.password, "pass")}
                    className="p-1 rounded hover:bg-gray-700 transition-colors"
                  >
                    {copied === "pass" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-600 mt-3">
              When setting up a terminal, use the Server IP shown above as the host (not &quot;localhost&quot;).
            </p>
          </div>
        )}

        {/* Connected Terminals */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Monitor className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Connected Terminals</h2>
                <p className="text-sm text-gray-400">
                  {heartbeatData
                    ? `${heartbeatData.onlineCount} online of ${heartbeatData.terminalCount} registered`
                    : "Loading..."}
                </p>
              </div>
            </div>
          </div>

          {!heartbeatData || heartbeatData.terminalCount === 0 ? (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-lg">No terminals connected yet</p>
              <p className="text-gray-600 text-sm mt-1">
                Terminals send a heartbeat every 30 seconds. They will appear here once connected and running.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {heartbeatData.terminals.map((terminal) => (
                <div
                  key={terminal.terminalId}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    terminal.isOnline
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-gray-800/20 border-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        terminal.isOnline ? "bg-green-500/20" : "bg-gray-700"
                      }`}
                    >
                      {terminal.isOnline ? (
                        <Wifi className="h-5 w-5 text-green-400" />
                      ) : (
                        <WifiOff className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{terminal.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">ID: {terminal.terminalId}</span>
                        <span className="text-xs text-gray-500">IP: {terminal.ip}</span>
                        {terminal.version && (
                          <span className="text-xs text-gray-500">v{terminal.version}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    {terminal.employeeName && (
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <User className="h-3.5 w-3.5" />
                        {terminal.employeeName}
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        terminal.shiftOpen
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {terminal.shiftOpen ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Shift Open
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          No Shift
                        </>
                      )}
                    </div>
                    <div className={`text-xs ${terminal.isOnline ? "text-green-400" : "text-gray-500"}`}>
                      {terminal.isOnline
                        ? formatLastSeen(terminal.lastSeenAgo)
                        : `Last seen ${formatLastSeen(terminal.lastSeenAgo)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Backup & Restore - Only visible in Electron */}
        {isElectron && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <FolderArchive className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Backup & Restore</h2>
                <p className="text-sm text-gray-400">Manage database backups</p>
              </div>
            </div>

            {backupStatus && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                backupStatus.includes('Error') || backupStatus.includes('fail')
                  ? 'bg-red-900/30 border border-red-800 text-red-300'
                  : 'bg-green-900/30 border border-green-800 text-green-300'
              }`}>
                {backupStatus}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={async () => {
                  setBacking(true);
                  setBackupStatus(null);
                  try {
                    const result = await (window as any).electron.backupDatabase();
                    setBackupStatus(result?.success ? `Backup created: ${result.filename}` : `Error: ${result?.error || 'Unknown'}`);
                    const b = await (window as any).electron.listBackups();
                    setBackups(b || []);
                  } catch (e: any) {
                    setBackupStatus(`Error: ${e.message}`);
                  } finally {
                    setBacking(false);
                  }
                }}
                disabled={backing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {backing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Create Backup
              </button>
              <button
                onClick={async () => {
                  setRestoring(true);
                  setBackupStatus(null);
                  try {
                    const filePath = await (window as any).electron.browseBackupFile();
                    if (filePath) {
                      const result = await (window as any).electron.restoreDatabase(filePath);
                      setBackupStatus(result?.success ? 'Database restored successfully! Restart the app to apply changes.' : `Error: ${result?.error || 'Unknown'}`);
                    } else {
                      setBackupStatus(null);
                    }
                  } catch (e: any) {
                    setBackupStatus(`Error: ${e.message}`);
                  } finally {
                    setRestoring(false);
                  }
                }}
                disabled={restoring}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Restore from File
              </button>
              <button
                onClick={() => (window as any).electron?.openBackupFolder?.()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                <FolderOpen className="h-4 w-4" />
                Open Backup Folder
              </button>
            </div>

            {backups.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Backups</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {backups.slice(0, 10).map((b: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-sm font-mono">{b.filename || b}</p>
                          {b.size && <p className="text-xs text-gray-500">{(b.size / 1024 / 1024).toFixed(1)} MB</p>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm('Restore this backup? This will overwrite the current database.')) {
                            setRestoring(true);
                            setBackupStatus(null);
                            try {
                              const result = await (window as any).electron.restoreDatabase(b.path || b);
                              setBackupStatus(result?.success ? 'Restored successfully! Restart the app.' : `Error: ${result?.error}`);
                            } catch (e: any) {
                              setBackupStatus(`Error: ${e.message}`);
                            } finally {
                              setRestoring(false);
                            }
                          }
                        }}
                        className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check for Updates - Only visible in Electron */}
        {isElectron && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Download className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Software Updates</h2>
                  <p className="text-sm text-gray-400">Check for the latest version of AzadiPOS</p>
                </div>
              </div>
              <button
                onClick={() => (window as any).electron?.checkForUpdates?.()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Check for Updates
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs pb-4">
          Auto-refreshing every 10 seconds
        </div>
      </main>
    </div>
  );
}
