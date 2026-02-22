"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericKeypad } from "@/components/numeric-keypad";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { formatCurrency } from "@/lib/helpers";
import {
  ArrowLeft,
  DollarSign,
  Check,
  ScanLine,
  Barcode,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId } = usePOS();
  
  // Manager barcode verification (changed from PIN)
  const [managerVerified, setManagerVerified] = useState(false);
  const [managerBarcode, setManagerBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [loading, setLoading] = useState(false);
  const managerInputRef = useRef<HTMLInputElement>(null);
  
  const [action, setAction] = useState<"injection" | null>(null);
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState(false);
  
  const [currentShift, setCurrentShift] = useState<any>(null);
  
  useEffect(() => {
    if (!employee) {
      router.push(`/pos/${companyId}/login`);
    }
  }, [employee, companyId, router]);
  
  useEffect(() => {
    if (shiftId) {
      fetchShift();
    }
  }, [shiftId]);
  
  // Auto-focus barcode input
  useEffect(() => {
    if (managerInputRef.current && !managerVerified && !loading) {
      setTimeout(() => managerInputRef.current?.focus(), 100);
    }
  }, [managerVerified, loading]);
  
  // Refocus on click anywhere
  useEffect(() => {
    const handleClick = () => {
      if (!managerVerified && managerInputRef.current && !loading) {
        managerInputRef.current.focus();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [managerVerified, loading]);
  
  const fetchShift = async () => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`);
      if (res.ok) {
        const shift = await res.json();
        setCurrentShift(shift);
      }
    } catch (err) {
      console.error("Failed to fetch shift:", err);
    }
  };
  
  const verifyManagerBarcode = async (scannedBarcode?: string) => {
    const barcodeToUse = scannedBarcode || managerBarcode;
    
    if (!barcodeToUse.trim()) {
      setBarcodeError("Please scan manager barcode");
      return;
    }
    
    setLoading(true);
    setBarcodeError("");
    
    try {
      const res = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, barcode: barcodeToUse }),
      });
      
      if (!res.ok) {
        setBarcodeError("Invalid barcode");
        setManagerBarcode("");
        return;
      }
      
      const manager = await res.json();
      
      // Check if manager
      if (manager.role !== "manager") {
        setBarcodeError("Manager authorization required");
        setManagerBarcode("");
        return;
      }
      
      setManagerVerified(true);
    } catch (err) {
      console.error("Barcode verification error:", err);
      setBarcodeError("Failed to verify. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManagerBarcode(value);
    setBarcodeError("");
    
    // Auto-submit on scanner input (EMP- prefix with sufficient length)
    if (value.startsWith("EMP-") && value.length >= 9) {
      setTimeout(() => verifyManagerBarcode(value), 100);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && managerBarcode.trim()) {
      verifyManagerBarcode();
    }
  };
  
  const handleCashInjection = async () => {
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) return;
    
    setLoading(true);
    
    try {
      // Update shift's cash injections
      if (shiftId && currentShift) {
        await fetch(`/api/shifts/${shiftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cashInjections: (currentShift.cashInjections || 0) + amountValue,
          }),
        });
      }
      
      // Log as transaction
      await fetch(`/api/companies/${companyId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          employeeId: employee?.id,
          type: "cash_injection",
          subtotal: amountValue,
          tax: 0,
          total: amountValue,
          paymentMethod: "cash",
          items: [],
        }),
      });
      
      setSuccess(true);
      setAmount("");
      setAction(null);
      fetchShift();
      
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Cash injection error:", err);
    } finally {
      setLoading(false);
    }
  };
  
  if (!employee) return null;
  
  // Manager barcode verification screen
  if (!managerVerified) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Button
          variant="ghost"
          onClick={() => router.push(`/pos/${companyId}/menu`)}
          className="absolute top-4 left-4 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-pos-card rounded-full flex items-center justify-center mx-auto mb-4 border border-pos-border">
            <ShieldCheck className="h-10 w-10 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold">Register Management</h1>
          <p className="text-gray-400 mt-2">Scan manager barcode to continue</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="p-8 bg-pos-card border-2 border-dashed border-yellow-500/50 rounded-xl flex flex-col items-center gap-4">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-yellow-400"
            >
              <ScanLine className="h-16 w-16" />
            </motion.div>
            <p className="text-gray-400 text-sm">Waiting for manager barcode scan...</p>
            
            <Input
              ref={managerInputRef}
              value={managerBarcode}
              onChange={handleBarcodeInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Scan manager barcode"
              className="bg-gray-800 border-gray-600 text-white text-center font-mono text-lg tracking-wider"
              autoComplete="off"
            />
            
            {managerBarcode && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Barcode className="h-5 w-5" />
                <span className="font-mono">{managerBarcode}</span>
              </div>
            )}
          </div>
          
          {barcodeError && (
            <p className="text-red-400 text-center text-sm mt-4">{barcodeError}</p>
          )}
          
          <Button
            onClick={() => verifyManagerBarcode()}
            disabled={loading || !managerBarcode.trim()}
            className="w-full h-14 text-lg mt-6 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700"
          >
            {loading ? <LoadingSpinner size="sm" /> : "Verify Manager"}
          </Button>
          
          <p className="text-center text-gray-500 text-xs mt-4">
            Only managers can access register operations
          </p>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/pos/${companyId}/menu`)}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Menu
        </Button>
        <h1 className="text-xl font-bold">Register Management</h1>
        <div className="w-24" />
      </div>
      
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-lg flex items-center gap-2"
        >
          <Check className="h-5 w-5 text-green-400" />
          <span className="text-green-200">Operation completed successfully</span>
        </motion.div>
      )}
      
      {/* Current Shift Info */}
      {currentShift && (
        <div className="mb-6 p-4 bg-pos-card border border-pos-border rounded-lg">
          <h3 className="font-semibold text-gray-400 mb-2">Current Shift</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Opening Balance</p>
              <p className="text-lg font-mono">{formatCurrency(currentShift.openingBalance || 0)}</p>
            </div>
            <div>
              <p className="text-gray-500">Cash Injections</p>
              <p className="text-lg font-mono">{formatCurrency(currentShift.cashInjections || 0)}</p>
            </div>
            <div>
              <p className="text-gray-500">Started</p>
              <p className="text-lg">{new Date(currentShift.startTime).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      {!action && (
        <div className="flex-1 flex items-center justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAction("injection")}
            className="p-8 bg-pos-card border border-pos-border rounded-lg hover:border-green-500/50 transition-colors"
          >
            <DollarSign className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <p className="text-lg font-semibold">Cash Injection</p>
            <p className="text-sm text-gray-400">Add cash to drawer</p>
          </motion.button>
        </div>
      )}
      
      {/* Amount Entry */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center max-w-xs mx-auto w-full"
        >
          <h2 className="text-xl font-semibold mb-2">Cash Injection</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter the amount being added to the drawer
          </p>
          
          <div className="w-full p-4 bg-pos-card border border-pos-border rounded-lg mb-4">
            <p className="text-4xl font-mono text-center">
              ${amount || "0.00"}
            </p>
          </div>
          
          <NumericKeypad
            onKeyPress={(key) => {
              if (key === "." && amount.includes(".")) return;
              setAmount(amount + key);
            }}
            onClear={() => setAmount("")}
            onBackspace={() => setAmount(amount.slice(0, -1))}
            onSubmit={handleCashInjection}
            submitLabel={loading ? "..." : "Confirm"}
            showDecimal
          />
          
          <Button
            variant="ghost"
            onClick={() => {
              setAction(null);
              setAmount("");
            }}
            className="mt-4"
          >
            Cancel
          </Button>
        </motion.div>
      )}
    </div>
  );
}
