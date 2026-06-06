"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NumericKeypad } from "@/components/numeric-keypad";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { ArrowLeft, Lock, Shield, CheckCircle, Receipt, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface ShiftSummary {
  shift: {
    id: string;
    employeeName: string;
    startTime: string;
    endTime: string | null;
    openingBalance: number;
    cashInjections: number;
    status: string;
  };
  summary: {
    totalSales: number;
    transactionCount: number;
    cashCollected: number;
    cardTotal: number;
    expectedCash: number;
    cashTransactionCount: number;
    cardTransactionCount: number;
  };
}

export default function CloseOutPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId, logout } = usePOS();
  
  const [step, setStep] = useState<"verify" | "summary" | "complete">("verify");
  const [managerPin, setManagerPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [closingShift, setClosingShift] = useState(false);
  
  useEffect(() => {
    if (!employee) {
      router.push(`/pos/${companyId}/login`);
    }
  }, [employee, companyId, router]);
  
  const verifyManagerPin = async () => {
    if (managerPin.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    
    setVerifying(true);
    setPinError("");
    
    try {
      const res = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, pin: managerPin }),
      });
      
      if (!res.ok) {
        setPinError("Invalid PIN");
        setManagerPin("");
        return;
      }
      
      const manager = await res.json();
      
      if (!manager.isManager) {
        setPinError("Manager PIN required");
        setManagerPin("");
        return;
      }
      
      // PIN verified, fetch shift summary
      await fetchShiftSummary();
      setStep("summary");
    } catch (err) {
      console.error("Verification error:", err);
      setPinError("Failed to verify PIN");
    } finally {
      setVerifying(false);
    }
  };
  
  const fetchShiftSummary = async () => {
    if (!shiftId) {
      // No active shift, create empty summary
      setShiftSummary({
        shift: {
          id: "",
          employeeName: employee?.name ?? "Unknown",
          startTime: new Date().toISOString(),
          endTime: null,
          openingBalance: 0,
          cashInjections: 0,
          status: "open",
        },
        summary: {
          totalSales: 0,
          transactionCount: 0,
          cashCollected: 0,
          cardTotal: 0,
          expectedCash: 0,
          cashTransactionCount: 0,
          cardTransactionCount: 0,
        },
      });
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setShiftSummary(data);
      }
    } catch (err) {
      console.error("Failed to fetch shift summary:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const closeShift = async () => {
    setClosingShift(true);
    
    try {
      if (shiftId) {
        await fetch(`/api/shifts/${shiftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "closed",
            closingBalance: shiftSummary?.summary?.expectedCash ?? 0,
          }),
        });
      }
      
      setStep("complete");
      
      // Wait and logout
      setTimeout(() => {
        logout();
        router.push(`/pos/${companyId}/login`);
      }, 3000);
    } catch (err) {
      console.error("Failed to close shift:", err);
    } finally {
      setClosingShift(false);
    }
  };
  
  if (!employee) return null;
  
  if (step === "complete") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-green-400">Shift Closed</h1>
          <p className="text-gray-400 mt-4">Returning to login screen...</p>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      <Button
        variant="ghost"
        onClick={() => router.push(`/pos/${companyId}/menu`)}
        className="self-start text-gray-400 hover:text-white mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      
      <div className="flex-1 flex items-center justify-center">
        {step === "verify" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-xs w-full"
          >
            <div className="w-20 h-20 bg-pos-card rounded-full flex items-center justify-center mx-auto mb-4 border border-pos-border">
              <Shield className="h-10 w-10 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Manager Verification</h1>
            <p className="text-gray-400 mb-6">Enter manager PIN to close out</p>
            
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 p-4 bg-pos-card border border-pos-border rounded-lg">
                <Lock className="h-5 w-5 text-gray-500" />
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full transition-colors ${
                        i < managerPin.length ? "bg-blue-500" : "bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
              {pinError && (
                <p className="text-red-400 text-sm mt-2">{pinError}</p>
              )}
            </div>
            
            <NumericKeypad
              onKeyPress={(key) => {
                if (managerPin.length < 4) {
                  setManagerPin(managerPin + key);
                  setPinError("");
                }
              }}
              onClear={() => {
                setManagerPin("");
                setPinError("");
              }}
              onBackspace={() => {
                setManagerPin(managerPin.slice(0, -1));
                setPinError("");
              }}
              onSubmit={verifyManagerPin}
              submitLabel={verifying ? "..." : "Verify"}
            />
          </motion.div>
        )}
        
        {step === "summary" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            {loading ? (
              <div className="flex justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <Receipt className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                  <h1 className="text-2xl font-bold">Shift Summary</h1>
                  <p className="text-gray-400">{shiftSummary?.shift?.employeeName}</p>
                </div>
                
                <div className="bg-pos-card border border-pos-border rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      Started: {formatDate(shiftSummary?.shift?.startTime)}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-pos-border">
                      <span className="text-gray-400">Total Sales</span>
                      <span className="font-semibold text-green-400">
                        {formatCurrency(shiftSummary?.summary?.totalSales)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-pos-border">
                      <span className="text-gray-400">Transactions</span>
                      <span className="font-semibold">{shiftSummary?.summary?.transactionCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-pos-border">
                      <span className="text-gray-400">Cash Sales ({shiftSummary?.summary?.cashTransactionCount ?? 0})</span>
                      <span className="font-semibold">{formatCurrency(shiftSummary?.summary?.cashCollected)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-pos-border">
                      <span className="text-gray-400">Card Sales ({shiftSummary?.summary?.cardTransactionCount ?? 0})</span>
                      <span className="font-semibold">{formatCurrency(shiftSummary?.summary?.cardTotal)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-pos-border">
                      <span className="text-gray-400">Opening Balance</span>
                      <span className="font-semibold">{formatCurrency(shiftSummary?.shift?.openingBalance)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-400">Expected Cash in Drawer</span>
                      <span className="font-bold text-lg text-yellow-400">
                        {formatCurrency(shiftSummary?.summary?.expectedCash)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-14 border-gray-600 text-gray-300"
                    onClick={() => {
                      setStep("verify");
                      setManagerPin("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="pos-primary"
                    className="flex-1 h-14"
                    disabled={closingShift}
                    onClick={closeShift}
                  >
                    {closingShift ? <LoadingSpinner size="sm" /> : "Close Shift"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}