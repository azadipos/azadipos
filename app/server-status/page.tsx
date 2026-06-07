"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Monitor,
  Wifi,
  WifiOff,
  Clock,
  HardDrive,
  Cpu,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  User,
  ArrowUpCircle,
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
    total: number;
    free: number;
    used: number;
  };
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
    const interval = setInterval(fetchData, 10000); // refresh every 10s
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
    const m = Math.floor(seconds / 60);
    return `${m}m ago`;
  };

  const memPercent = serverInfo
    ? Math.round((serverInfo.memoryUsage.used / serverInfo.memoryUsage.total) * 100)
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

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
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
                  Memory
                </div>
                <p className="text-lg font-semibold">{serverInfo.memoryUsage.used} MB</p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      memPercent > 80 ? "bg-red-500" : memPercent > 60 ? "bg-yellow-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${memPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{memPercent}% of {serverInfo.memoryUsage.total} MB</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Cpu className="h-4 w-4" />
                  Platform
                </div>
                <p className="text-lg font-semibold capitalize">{serverInfo.platform}</p>
                <p className="text-xs text-gray-500">{serverInfo.nodeVersion}</p>
              </div>
            </div>
          )}
        </div>

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
              <p className="text-gray-500 text-lg">No terminals connected</p>
              <p className="text-gray-600 text-sm mt-1">
                Terminals will appear here once they connect to this server
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

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs pb-4">
          Auto-refreshing every 10 seconds
        </div>
      </main>
    </div>
  );
}
