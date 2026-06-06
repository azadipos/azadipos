"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

// Type declarations for Electron IPC
declare global {
  interface Window {
    electronStore?: {
      isElectron: boolean;
      getTerminalId: () => Promise<string>;
      getOfflineQueue: () => Promise<{ transactions: OfflineTransaction[]; [key: string]: any }>;
      addOfflineTransaction: (transaction: OfflineTransaction) => Promise<number>;
      removeOfflineTransactions: (localIds: string[]) => Promise<number>;
      getNextOfflineCounter: (companyId: string) => Promise<number>;
      clearOfflineQueue: () => Promise<{ success: boolean }>;
    };
  }
}

interface OfflineTransaction {
  localId: string;
  localTransactionNumber: string;
  terminalId: string;
  data: any;
  createdAt: string;
}

interface SyncResult {
  localId: string;
  serverId?: string;
  localTransactionNumber?: string;
  serverTransactionNumber?: string;
  status: string;
  error?: string;
}

interface OfflineContextType {
  isOnline: boolean;
  isServerReachable: boolean;
  pendingTransactions: OfflineTransaction[];
  terminalId: string;
  addOfflineTransaction: (data: any) => Promise<OfflineTransaction>;
  syncPendingTransactions: (companyId: string) => Promise<SyncResult[]>;
  clearSyncedTransactions: (localIds: string[]) => Promise<void>;
  getNextLocalTransactionNumber: (companyId: string) => Promise<string>;
  isElectron: boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const STORAGE_KEY = "azadipos_offline_transactions";
const LOCAL_TXN_COUNTER_KEY = "azadipos_local_txn_counter";
const TERMINAL_ID_KEY = "azadipos_terminal_id";

// Generate a random terminal ID for web fallback
function generateWebTerminalId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "W"; // Prefix with W for Web terminals
  for (let i = 0; i < 3; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [pendingTransactions, setPendingTransactions] = useState<OfflineTransaction[]>([]);
  const [terminalId, setTerminalId] = useState<string>("");
  const [isElectron, setIsElectron] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);
  
  // Initialize terminal ID and load pending transactions
  useEffect(() => {
    if (typeof window === "undefined" || initializedRef.current) return;
    initializedRef.current = true;
    
    const init = async () => {
      // Check if running in Electron
      const electronAvailable = !!window.electronStore?.isElectron;
      setIsElectron(electronAvailable);
      
      if (electronAvailable) {
        // Use Electron storage
        try {
          const tid = await window.electronStore!.getTerminalId();
          setTerminalId(tid);
          
          const queue = await window.electronStore!.getOfflineQueue();
          setPendingTransactions(queue.transactions || []);
        } catch (e) {
          console.error("Failed to initialize Electron storage:", e);
        }
      } else {
        // Fallback to localStorage for web
        let tid = localStorage.getItem(TERMINAL_ID_KEY);
        if (!tid) {
          tid = generateWebTerminalId();
          localStorage.setItem(TERMINAL_ID_KEY, tid);
        }
        setTerminalId(tid);
        
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            setPendingTransactions(JSON.parse(stored));
          } catch (e) {
            console.error("Failed to parse offline transactions:", e);
          }
        }
      }
    };
    
    init();
  }, []);
  
  // Sync localStorage when pendingTransactions change (web fallback only)
  useEffect(() => {
    if (typeof window === "undefined" || isElectron) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingTransactions));
  }, [pendingTransactions, isElectron]);
  
  // Monitor online/offline status
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => {
        setIsOnline(false);
        setIsServerReachable(false);
      };
      
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);
  
  // Periodically check server reachability
  const checkServerReachability = useCallback(async () => {
    if (!isOnline) {
      setIsServerReachable(false);
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch("/api/health", {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      setIsServerReachable(res.ok);
    } catch (e) {
      setIsServerReachable(false);
    }
  }, [isOnline]);
  
  // Start/stop server reachability checks
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Initial check
      checkServerReachability();
      
      // Periodic checks every 30 seconds
      checkIntervalRef.current = setInterval(checkServerReachability, 30000);
      
      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      };
    }
  }, [checkServerReachability]);
  
  // Generate next local transaction number with terminal suffix
  // Format: OFF-{TERMINAL_ID}-{COUNTER} e.g., OFF-ABC1-000001
  const getNextLocalTransactionNumber = useCallback(async (companyId: string): Promise<string> => {
    if (typeof window === "undefined") return `OFF-${terminalId || "UNKN"}-000001`;
    
    let counter: number;
    
    if (isElectron && window.electronStore) {
      // Use Electron storage for counter
      counter = await window.electronStore.getNextOfflineCounter(companyId);
    } else {
      // Use localStorage fallback
      const key = `${LOCAL_TXN_COUNTER_KEY}_${companyId}`;
      const current = parseInt(localStorage.getItem(key) || "0");
      counter = current + 1;
      localStorage.setItem(key, String(counter));
    }
    
    // Include terminal ID to prevent conflicts across terminals
    return `OFF-${terminalId}-${counter.toString().padStart(6, "0")}`;
  }, [terminalId, isElectron]);
  
  // Add a transaction to offline queue
  const addOfflineTransaction = useCallback(async (data: any): Promise<OfflineTransaction> => {
    const localId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const localTransactionNumber = data.transactionNumber || `OFF-${terminalId}-UNKNOWN`;
    
    const offlineTx: OfflineTransaction = {
      localId,
      localTransactionNumber,
      terminalId: terminalId || "UNKN",
      data,
      createdAt: new Date().toISOString(),
    };
    
    if (isElectron && window.electronStore) {
      // Store in Electron's persistent storage
      await window.electronStore.addOfflineTransaction(offlineTx);
    }
    
    // Also update React state
    setPendingTransactions(prev => [...prev, offlineTx]);
    return offlineTx;
  }, [terminalId, isElectron]);
  
  // Sync pending transactions with server
  const syncPendingTransactions = useCallback(async (companyId: string): Promise<SyncResult[]> => {
    if (!isOnline || !isServerReachable || pendingTransactions.length === 0) {
      return [];
    }
    
    try {
      const items = pendingTransactions.map(tx => ({
        localId: tx.localId,
        localTransactionNumber: tx.localTransactionNumber,
        terminalId: tx.terminalId,
        entityType: "transaction",
        entityData: JSON.stringify(tx.data),
      }));
      
      const res = await fetch("/api/offline-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, items }),
      });
      
      if (!res.ok) {
        throw new Error("Sync failed");
      }
      
      const data = await res.json();
      return data.results || [];
    } catch (e) {
      console.error("Failed to sync offline transactions:", e);
      return [];
    }
  }, [isOnline, isServerReachable, pendingTransactions]);
  
  // Clear synced transactions from queue
  const clearSyncedTransactions = useCallback(async (localIds: string[]) => {
    if (isElectron && window.electronStore) {
      await window.electronStore.removeOfflineTransactions(localIds);
    }
    setPendingTransactions(prev => prev.filter(tx => !localIds.includes(tx.localId)));
  }, [isElectron]);
  
  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isServerReachable,
        pendingTransactions,
        terminalId,
        addOfflineTransaction,
        syncPendingTransactions,
        clearSyncedTransactions,
        getNextLocalTransactionNumber,
        isElectron,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
