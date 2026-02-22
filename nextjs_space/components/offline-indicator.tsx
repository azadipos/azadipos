"use client";

import { useOffline } from "@/lib/offline-context";
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";

interface OfflineIndicatorProps {
  companyId: string;
  showSyncButton?: boolean;
}

export function OfflineIndicator({ companyId, showSyncButton = true }: OfflineIndicatorProps) {
  const { isOnline, isServerReachable, pendingTransactions, syncPendingTransactions, clearSyncedTransactions } = useOffline();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: number; failed: number } | null>(null);
  
  const handleSync = async () => {
    if (syncing || pendingTransactions.length === 0) return;
    
    setSyncing(true);
    setLastSyncResult(null);
    
    try {
      const results = await syncPendingTransactions(companyId);
      const syncedIds = results.filter(r => r.status === "synced").map(r => r.localId);
      const failedCount = results.filter(r => r.status !== "synced").length;
      
      if (syncedIds.length > 0) {
        clearSyncedTransactions(syncedIds);
      }
      
      setLastSyncResult({ success: syncedIds.length, failed: failedCount });
      
      // Clear result after 5 seconds
      setTimeout(() => setLastSyncResult(null), 5000);
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setSyncing(false);
    }
  };
  
  // Don't show if online and no pending transactions
  if (isOnline && isServerReachable && pendingTransactions.length === 0) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg border ${
        !isOnline || !isServerReachable
          ? "bg-red-900/90 border-red-700"
          : pendingTransactions.length > 0
          ? "bg-amber-900/90 border-amber-700"
          : "bg-green-900/90 border-green-700"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        {!isOnline ? (
          <WifiOff className="h-5 w-5 text-red-400" />
        ) : !isServerReachable ? (
          <CloudOff className="h-5 w-5 text-red-400" />
        ) : (
          <Cloud className="h-5 w-5 text-amber-400" />
        )}
        
        {/* Status Text */}
        <div>
          <p className="font-medium text-sm">
            {!isOnline ? "Offline Mode" : !isServerReachable ? "Server Unreachable" : "Pending Sync"}
          </p>
          <p className="text-xs opacity-75">
            {pendingTransactions.length} transaction{pendingTransactions.length !== 1 ? "s" : ""} pending
          </p>
        </div>
        
        {/* Sync Button */}
        {showSyncButton && pendingTransactions.length > 0 && isOnline && isServerReachable && (
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="bg-white/20 hover:bg-white/30 text-white"
          >
            {syncing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      {/* Sync Result */}
      <AnimatePresence>
        {lastSyncResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-white/20"
          >
            <div className="flex items-center gap-2 text-sm">
              {lastSyncResult.failed === 0 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>Synced {lastSyncResult.success} transaction(s)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span>{lastSyncResult.success} synced, {lastSyncResult.failed} failed</span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
