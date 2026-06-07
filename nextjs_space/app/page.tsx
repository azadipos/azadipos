"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Building2, Monitor, Settings, RefreshCw, Server, Copy, Check, Eye, EyeOff, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// TypeScript declarations for Electron APIs
declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      reconfigure: () => Promise<{ success: boolean }>;
      getConfig: () => Promise<any>;
      getLocalIps: () => Promise<Array<{ name: string; address: string }>>;
      configureLanAccess: () => Promise<{ success: boolean; error?: string; restartNeeded?: boolean }>;
    };
  }
}

interface ServerInfo {
  host: string;
  port: string;
  username: string;
  password: string;
  dbName: string;
  connectionString: string;
  localIps: Array<{ name: string; address: string }>;
}

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [showServerInfo, setShowServerInfo] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [reconfiguring, setReconfiguring] = useState(false);
  const [fixingLan, setFixingLan] = useState(false);
  const [lanStatus, setLanStatus] = useState<string | null>(null);
  
  useEffect(() => {
    setMounted(true);
    setIsElectron(!!window.electron?.isElectron);
  }, []);
  
  const loadServerInfo = async () => {
    if (!window.electron) return;
    setLoadingInfo(true);
    try {
      const [config, ips] = await Promise.all([
        window.electron.getConfig(),
        window.electron.getLocalIps(),
      ]);
      if (config?.databaseUrl) {
        // Prefer explicit fields saved in config (reliable), fall back to URL parsing
        let host = config.host || '';
        let port = config.port || '5432';
        let username = config.username || '';
        let password = config.password || '';
        let dbName = config.dbName || '';
        
        // Fall back to parsing from URL if fields are missing
        if (!host || !username) {
          try {
            const url = new URL(config.databaseUrl);
            host = host || url.hostname || 'localhost';
            port = port || url.port || '5432';
            username = username || decodeURIComponent(url.username) || 'postgres';
            password = password || decodeURIComponent(url.password) || '';
            dbName = dbName || url.pathname.replace(/^\//, '') || 'azadipos';
          } catch {
            // URL parsing failed, use whatever fields we have
          }
        }
        
        setServerInfo({
          host,
          port,
          username,
          password,
          dbName,
          connectionString: config.databaseUrl,
          localIps: ips || [],
        });
      }
    } catch (err) {
      console.error('Failed to load server info:', err);
    } finally {
      setLoadingInfo(false);
    }
  };

  const toggleServerInfo = async () => {
    if (!showServerInfo && !serverInfo) {
      await loadServerInfo();
    }
    setShowServerInfo(!showServerInfo);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleReconfigure = async () => {
    if (!window.electron) return;
    setReconfiguring(true);
    try {
      await window.electron.reconfigure();
    } catch (err) {
      console.error('Reconfigure failed:', err);
      setReconfiguring(false);
    }
  };

  const handleFixLan = async () => {
    if (!window.electron) return;
    setFixingLan(true);
    setLanStatus(null);
    try {
      const result = await window.electron.configureLanAccess();
      if (result.success) {
        setLanStatus(result.restartNeeded 
          ? 'LAN access configured! Database service is restarting...' 
          : 'LAN access is already configured.');
      } else {
        setLanStatus(`Failed: ${result.error || 'Unknown error'}. Try running the app as Administrator.`);
      }
    } catch (err: any) {
      setLanStatus(`Error: ${err?.message || 'Unknown error'}. Try running the app as Administrator.`);
    } finally {
      setFixingLan(false);
    }
  };
  
  if (!mounted) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center w-full max-w-2xl"
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <Building2 className="h-12 w-12 text-blue-500" />
          <h1 className="text-4xl font-bold text-white">Azadi POS</h1>
        </div>
        
        <p className="text-gray-400 mb-12 text-lg">
          Welcome! Please select your interface:
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-64 h-32 flex flex-col gap-3 bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-blue-500 text-white transition-all"
              onClick={() => router.push("/admin")}
            >
              <Settings className="h-8 w-8 text-blue-400" />
              <span className="text-lg font-semibold">Admin Portal</span>
              <span className="text-sm text-gray-400">Manage inventory & employees</span>
            </Button>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-64 h-32 flex flex-col gap-3 bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-green-500 text-white transition-all"
              onClick={() => router.push("/pos")}
            >
              <Monitor className="h-8 w-8 text-green-400" />
              <span className="text-lg font-semibold">POS Terminal</span>
              <span className="text-sm text-gray-400">Process transactions</span>
            </Button>
          </motion.div>
        </div>

        {/* Electron-only controls */}
        {isElectron && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 space-y-4"
          >
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 bg-transparent"
                onClick={toggleServerInfo}
              >
                <Server className="h-4 w-4 mr-2" />
                {showServerInfo ? 'Hide' : 'Show'} Server Info
              </Button>
              <Button
                variant="outline"
                className="border-gray-700 text-gray-400 hover:text-orange-400 hover:border-orange-500/50 bg-transparent"
                onClick={handleReconfigure}
                disabled={reconfiguring}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${reconfiguring ? 'animate-spin' : ''}`} />
                Reconfigure Connection
              </Button>
            </div>

            {/* Server Info Panel */}
            <AnimatePresence>
              {showServerInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-6 text-left max-w-lg mx-auto">
                    <div className="flex items-center gap-2 mb-4">
                      <Wifi className="h-5 w-5 text-green-400" />
                      <h3 className="text-lg font-semibold text-white">Terminal Connection Info</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      Use these credentials when setting up a POS terminal on another computer.
                      Both computers must be on the same network.
                    </p>

                    {loadingInfo ? (
                      <div className="text-center py-4">
                        <div className="animate-spin h-6 w-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto" />
                        <p className="text-sm text-gray-500 mt-2">Loading...</p>
                      </div>
                    ) : serverInfo ? (
                      <div className="space-y-3">
                        {/* Server IP */}
                        {serverInfo.localIps.length > 0 && (
                          <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide">Server IP Address</label>
                            {serverInfo.localIps.map((ip) => (
                              <div key={ip.address} className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2 mt-1">
                                <div>
                                  <span className="text-white font-mono text-sm">{ip.address}</span>
                                  <span className="text-gray-500 text-xs ml-2">({ip.name})</span>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(ip.address, `ip-${ip.address}`)}
                                  className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                                >
                                  {copied === `ip-${ip.address}` ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Port */}
                        <InfoRow label="Port" value={serverInfo.port} onCopy={() => copyToClipboard(serverInfo.port, 'port')} copied={copied === 'port'} />

                        {/* Username */}
                        <InfoRow label="Username" value={serverInfo.username} onCopy={() => copyToClipboard(serverInfo.username, 'username')} copied={copied === 'username'} />

                        {/* Password */}
                        <div>
                          <label className="text-xs text-gray-500 uppercase tracking-wide">Password</label>
                          <div className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2 mt-1">
                            <span className="text-white font-mono text-sm">
                              {showPassword 
                                ? (serverInfo.password || <span className="text-gray-500 italic">not stored</span>)
                                : (serverInfo.password ? '•'.repeat(serverInfo.password.length) : <span className="text-gray-500 italic">not stored</span>)
                              }
                            </span>
                            <div className="flex items-center gap-1">
                              {serverInfo.password && (
                                <>
                                  <button
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                                  >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(serverInfo.password, 'password')}
                                    className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                                  >
                                    {copied === 'password' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Database Name */}
                        <InfoRow label="Database Name" value={serverInfo.dbName} onCopy={() => copyToClipboard(serverInfo.dbName, 'dbname')} copied={copied === 'dbname'} />

                        {/* Connection String for Terminals */}
                        {serverInfo.localIps.length > 0 && serverInfo.password && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <label className="text-xs text-gray-500 uppercase tracking-wide">Connection String for Terminals</label>
                            <p className="text-xs text-gray-400 mt-1 mb-2">Copy this and paste it on your terminal computer:</p>
                            {serverInfo.localIps.map((ip) => {
                              const connStr = `postgresql://${serverInfo.username}:${encodeURIComponent(serverInfo.password)}@${ip.address}:${serverInfo.port}/${serverInfo.dbName}`;
                              return (
                                <div key={ip.address} className="flex items-center justify-between bg-blue-900/30 border border-blue-800/50 rounded-lg px-3 py-2 mt-1">
                                  <span className="text-blue-200 font-mono text-xs break-all mr-2">{connStr}</span>
                                  <button
                                    onClick={() => copyToClipboard(connStr, `conn-${ip.address}`)}
                                    className="text-gray-400 hover:text-blue-400 transition-colors p-1 flex-shrink-0"
                                  >
                                    {copied === `conn-${ip.address}` ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                </div>
                              );
                            })}  
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-red-400">Could not load connection info. Try reconfiguring.</p>
                    )}

                    {/* LAN Access Fix */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-2">
                        Terminal can&apos;t connect? This configures the database to accept network connections.
                      </p>
                      <Button
                        variant="outline"
                        className="w-full border-gray-600 text-gray-300 hover:text-white hover:border-blue-500 bg-transparent"
                        onClick={handleFixLan}
                        disabled={fixingLan}
                      >
                        <Wifi className={`h-4 w-4 mr-2 ${fixingLan ? 'animate-pulse' : ''}`} />
                        {fixingLan ? 'Configuring...' : 'Enable LAN Access for Terminals'}
                      </Button>
                      {lanStatus && (
                        <p className={`text-xs mt-2 ${lanStatus.includes('Failed') || lanStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                          {lanStatus}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// Reusable row component for server info fields
function InfoRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2 mt-1">
        <span className="text-white font-mono text-sm">{value}</span>
        <button
          onClick={onCopy}
          className="text-gray-400 hover:text-blue-400 transition-colors p-1"
        >
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}