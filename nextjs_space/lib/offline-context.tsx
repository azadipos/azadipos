"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

interface OfflineTransaction {
  localId: string;
  localTransactionNumber: string;
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
  addOfflineTransaction: (data: any) => OfflineTransaction;
  syncPendingTransactions: (companyId: string) => Promise<SyncResult[]>;
  clearSyncedTransactions: (localIds: string[]) => void;
  getNextLocalTransactionNumber: (companyId: string) => string;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const STORAGE_KEY = "azadipos_offline_transactions";
const LOCAL_TXN_COUNTER_KEY = "azadipos_local_txn_counter";

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [pendingTransactions, setPendingTransactions] = useState<OfflineTransaction[]>([]);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load pending transactions from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setPendingTransactions(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse offline transactions:", e);
        }
      }
    }
  }, []);
  
  // Save pending transactions to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingTransactions));
    }
  }, [pendingTransactions]);
  
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
  
  // Generate next local transaction number
  const getNextLocalTransactionNumber = useCallback((companyId: string): string => {
    if (typeof window === "undefined") return "LOCAL-000001";
    
    const key = `${LOCAL_TXN_COUNTER_KEY}_${companyId}`;
    const current = parseInt(localStorage.getItem(key) || "0");
    const next = current + 1;
    localStorage.setItem(key, String(next));
    
    return `LOCAL-${next.toString().padStart(6, "0")}`;
  }, []);
  
  // Add a transaction to offline queue
  const addOfflineTransaction = useCallback((data: any): OfflineTransaction => {
    const localId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const localTransactionNumber = data.transactionNumber || "LOCAL-UNKNOWN";
    
    const offlineTx: OfflineTransaction = {
      localId,
      localTransactionNumber,
      data,
      createdAt: new Date().toISOString(),
    };
    
    setPendingTransactions(prev => [...prev, offlineTx]);
    return offlineTx;
  }, []);
  
  // Sync pending transactions with server
  const syncPendingTransactions = useCallback(async (companyId: string): Promise<SyncResult[]> => {
    if (!isOnline || !isServerReachable || pendingTransactions.length === 0) {
      return [];
    }
    
    try {
      const items = pendingTransactions.map(tx => ({
        localId: tx.localId,
        localTransactionNumber: tx.localTransactionNumber,
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
  const clearSyncedTransactions = useCallback((localIds: string[]) => {
    setPendingTransactions(prev => prev.filter(tx => !localIds.includes(tx.localId)));
  }, []);
  
  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isServerReachable,
        pendingTransactions,
        addOfflineTransaction,
        syncPendingTransactions,
        clearSyncedTransactions,
        getNextLocalTransactionNumber,
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
