"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { formatCurrency } from "@/lib/helpers";
import {
  ArrowLeft,
  Clock,
  DollarSign,
  CreditCard,
  Banknote,
  RotateCcw,
  Receipt,
  TrendingUp,
  Gift,
  CheckCircle,
  AlertTriangle,
  ScanLine,
  Shield,
} from "lucide-react";
import { motion } from "framer-motion";

interface ShiftStats {
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  totalStoreCreditsIssued: number;
  transactionCount: number;
  refundCount: number;
  voidCount: number;
  storeCreditCount: number;
  cashSales: number;
  cardSales: number;
  averageTransaction: number;
  hourlyBreakdown: { hour: number; sales: number; transactions: number }[];
}

interface ShiftData {
  id: string;
  startTime: string;
  endTime: string | null;
  openingBalance: number;
  closingBalance: number | null;
  cashInjections: number;
  status: string;
  employee: { id: string; name: string };
}

export default function ShiftReportPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId, closeShift } = usePOS();
  
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<ShiftData | null>(null);
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [closingBalance, setClosingBalance] = useState("");
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  
  // Manager authorization state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [managerBarcode, setManagerBarcode] = useState("");
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!employee || !shiftId) {
      router.push(`/pos/${companyId}/login`);
      return;
    }
    fetchShiftData();
  }, [employee, shiftId, companyId, router]);
  
  useEffect(() => {
    if (showAuthModal && barcodeInputRef.current) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [showAuthModal]);
  
  const fetchShiftData = async () => {
    if (!shiftId) return;
    
    try {
      // Fetch shift details
      const shiftRes = await fetch(`/api/shifts/${shiftId}`);
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json();
        setShift(shiftData);
      }
      
      // Fetch shift stats
      const statsRes = await fetch(`/api/shifts/${shiftId}/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Failed to fetch shift data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const initiateCloseShift = () => {
    if (!closingBalance) return;
    setShowAuthModal(true);
    setManagerBarcode("");
    setAuthError("");
  };
  
  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManagerBarcode(value);
    setAuthError("");
    
    // Auto-submit when barcode pattern detected (fast input)
    if (value.startsWith("EMP-") && value.length >= 9) {
      verifyManagerAndClose(value);
    }
  };
  
  const verifyManagerAndClose = async (barcode: string) => {
    if (!barcode || verifying) return;
    
    setVerifying(true);
    setAuthError("");
    
    try {
      // Verify manager
      const verifyRes = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, barcode }),
      });
      
      if (!verifyRes.ok) {
        setAuthError("Invalid manager barcode");
        setManagerBarcode("");
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
        setVerifying(false);
        return;
      }
      
      const manager = await verifyRes.json();
      
      if (!manager.isManager) {
        setAuthError("Manager authorization required");
        setManagerBarcode("");
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
        setVerifying(false);
        return;
      }
      
      // Close the shift with manager authorization
      setClosing(true);
      const res = await fetch(`/api/shifts/${shiftId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingBalance: parseFloat(closingBalance),
          closedByEmployeeId: manager.id,
        }),
      });
      
      if (res.ok) {
        setShowAuthModal(false);
        setClosed(true);
        if (closeShift) closeShift();
        
        setTimeout(() => {
          router.push(`/pos/${companyId}/login`);
        }, 3000);
      } else {
        setAuthError("Failed to close shift");
      }
    } catch (err) {
      console.error("Failed to close shift:", err);
      setAuthError("An error occurred");
    } finally {
      setClosing(false);
      setVerifying(false);
    }
  };
  
  const expectedCash = (() => {
    if (!shift || !stats) return 0;
    return shift.openingBalance + shift.cashInjections + stats.cashSales - Math.abs(stats.totalRefunds);
  })();
  
  const variance = closingBalance ? parseFloat(closingBalance) - expectedCash : 0;
  
  if (!employee) return null;
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (closed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-green-400">Shift Closed</h1>
          <p className="text-gray-400 mt-4">Returning to login...</p>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/pos/${companyId}/menu`)}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Menu
          </Button>
          <h1 className="text-2xl font-bold">End of Day Report</h1>
          <div className="w-24" />
        </div>
        
        {/* Shift Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-6 bg-gray-800/50 border border-gray-700 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Employee</p>
              <p className="text-xl font-semibold">{employee.name}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Shift Started</p>
              <p className="font-mono">{shift?.startTime ? new Date(shift.startTime).toLocaleString() : "-"}</p>
            </div>
          </div>
        </motion.div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 bg-green-600/20 border border-green-600/30 rounded-lg"
          >
            <DollarSign className="h-6 w-6 text-green-400 mb-2" />
            <p className="text-sm text-green-400">Total Sales</p>
            <p className="text-2xl font-bold">{formatCurrency(stats?.totalSales ?? 0)}</p>
            <p className="text-xs text-gray-500">{stats?.transactionCount ?? 0} transactions</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-4 bg-blue-600/20 border border-blue-600/30 rounded-lg"
          >
            <CreditCard className="h-6 w-6 text-blue-400 mb-2" />
            <p className="text-sm text-blue-400">Card Sales</p>
            <p className="text-2xl font-bold">{formatCurrency(stats?.cardSales ?? 0)}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 bg-emerald-600/20 border border-emerald-600/30 rounded-lg"
          >
            <Banknote className="h-6 w-6 text-emerald-400 mb-2" />
            <p className="text-sm text-emerald-400">Cash Sales</p>
            <p className="text-2xl font-bold">{formatCurrency(stats?.cashSales ?? 0)}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-4 bg-purple-600/20 border border-purple-600/30 rounded-lg"
          >
            <TrendingUp className="h-6 w-6 text-purple-400 mb-2" />
            <p className="text-sm text-purple-400">Avg Transaction</p>
            <p className="text-2xl font-bold">{formatCurrency(stats?.averageTransaction ?? 0)}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 bg-red-600/20 border border-red-600/30 rounded-lg"
          >
            <RotateCcw className="h-6 w-6 text-red-400 mb-2" />
            <p className="text-sm text-red-400">Refunds</p>
            <p className="text-2xl font-bold">{formatCurrency(Math.abs(stats?.totalRefunds ?? 0))}</p>
            <p className="text-xs text-gray-500">{stats?.refundCount ?? 0} refunds</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="p-4 bg-orange-600/20 border border-orange-600/30 rounded-lg"
          >
            <Receipt className="h-6 w-6 text-orange-400 mb-2" />
            <p className="text-sm text-orange-400">Voids</p>
            <p className="text-2xl font-bold">{stats?.voidCount ?? 0}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 bg-yellow-600/20 border border-yellow-600/30 rounded-lg"
          >
            <Gift className="h-6 w-6 text-yellow-400 mb-2" />
            <p className="text-sm text-yellow-400">Store Credits</p>
            <p className="text-2xl font-bold">{formatCurrency(stats?.totalStoreCreditsIssued ?? 0)}</p>
            <p className="text-xs text-gray-500">{stats?.storeCreditCount ?? 0} issued</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="p-4 bg-gray-700/50 border border-gray-600 rounded-lg"
          >
            <Clock className="h-6 w-6 text-gray-400 mb-2" />
            <p className="text-sm text-gray-400">Duration</p>
            <p className="text-2xl font-bold">
              {shift?.startTime
                ? Math.round((Date.now() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60))
                : 0}h
            </p>
          </motion.div>
        </div>
        
        {/* Cash Drawer Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg mb-6"
        >
          <h2 className="text-lg font-semibold mb-4">Cash Drawer Reconciliation</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Opening Balance</span>
                <span className="font-mono">{formatCurrency(shift?.openingBalance ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cash Sales</span>
                <span className="font-mono text-green-400">+{formatCurrency(stats?.cashSales ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cash Refunds</span>
                <span className="font-mono text-red-400">-{formatCurrency(Math.abs(stats?.totalRefunds ?? 0))}</span>
              </div>
              {(shift?.cashInjections ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Cash Injections</span>
                  <span className="font-mono text-blue-400">+{formatCurrency(shift?.cashInjections ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-gray-700 pt-3">
                <span>Expected Cash</span>
                <span className="font-mono text-yellow-400">{formatCurrency(expectedCash)}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Actual Cash Count</label>
              <div className="flex items-center gap-2">
                <span className="text-2xl text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  placeholder="Enter counted cash"
                  className="flex-1 h-14 px-4 text-2xl font-mono bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              {closingBalance && (
                <div className={`mt-4 p-3 rounded-lg ${
                  Math.abs(variance) < 0.01 
                    ? "bg-green-600/20 border border-green-600/30"
                    : Math.abs(variance) <= 5
                    ? "bg-yellow-600/20 border border-yellow-600/30"
                    : "bg-red-600/20 border border-red-600/30"
                }`}>
                  <div className="flex items-center gap-2">
                    {Math.abs(variance) < 0.01 ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    )}
                    <span className={`font-medium ${
                      Math.abs(variance) < 0.01 ? "text-green-400" :
                      Math.abs(variance) <= 5 ? "text-yellow-400" :
                      "text-red-400"
                    }`}>
                      {Math.abs(variance) < 0.01 
                        ? "Balanced" 
                        : variance > 0 
                        ? `Over by ${formatCurrency(variance)}` 
                        : `Short by ${formatCurrency(Math.abs(variance))}`
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
        
        {/* Close Shift Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-end"
        >
          <Button
            size="lg"
            className="bg-red-600 hover:bg-red-700 h-14 px-8 text-lg"
            onClick={initiateCloseShift}
            disabled={!closingBalance || closing}
          >
            {closing ? <LoadingSpinner size="sm" /> : "Close Shift"}
          </Button>
        </motion.div>
      </div>
      
      {/* Manager Authorization Modal */}
      <Modal
        isOpen={showAuthModal}
        onClose={() => !verifying && !closing && setShowAuthModal(false)}
        title="Manager Authorization Required"
      >
        <div className="space-y-4">
          <div className="p-4 bg-yellow-600/20 border border-yellow-600/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-yellow-400" />
              <span className="font-semibold text-yellow-400">Authorization Required</span>
            </div>
            <p className="text-sm text-gray-300">
              A manager must scan their barcode to close the shift and verify the cash count.
            </p>
          </div>
          
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Cash Variance</p>
            <p className={`text-xl font-bold ${
              Math.abs(variance) < 0.01 ? "text-green-400" :
              Math.abs(variance) <= 5 ? "text-yellow-400" : "text-red-400"
            }`}>
              {Math.abs(variance) < 0.01 
                ? "Balanced" 
                : variance > 0 
                ? `Over by ${formatCurrency(variance)}` 
                : `Short by ${formatCurrency(Math.abs(variance))}`
              }
            </p>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              <ScanLine className="inline h-4 w-4 mr-1" />
              Scan Manager Barcode
            </label>
            <Input
              ref={barcodeInputRef}
              type="text"
              value={managerBarcode}
              onChange={handleBarcodeInput}
              placeholder="Scan or type manager barcode..."
              className="font-mono"
              disabled={verifying || closing}
              autoComplete="off"
            />
          </div>
          
          {authError && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
              {authError}
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowAuthModal(false)}
              disabled={verifying || closing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => verifyManagerAndClose(managerBarcode)}
              disabled={!managerBarcode || verifying || closing}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {verifying || closing ? <LoadingSpinner size="sm" /> : "Authorize & Close"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
