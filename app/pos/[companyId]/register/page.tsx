"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { NumericKeypad } from "@/components/numeric-keypad";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { formatCurrency } from "@/lib/helpers";
import {
  ArrowLeft,
  DollarSign,
  PiggyBank,
  Check,
} from "lucide-react";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId, setShiftId } = usePOS();
  
  const [managerVerified, setManagerVerified] = useState(false);
  const [managerPin, setManagerPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [action, setAction] = useState<"opening" | "injection" | null>(null);
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
  
  const verifyManagerPin = async () => {
    if (managerPin.length < 4) return;
    
    setLoading(true);
    setPinError("");
    
    try {
      const res = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, pin: managerPin, requireManager: true }),
      });
      
      if (!res.ok) {
        setPinError("Invalid manager PIN");
        setManagerPin("");
        return;
      }
      
      setManagerVerified(true);
    } catch (err) {
      console.error("PIN verification error:", err);
      setPinError("Failed to verify PIN");
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpeningBalance = async () => {
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue < 0) return;
    
    setLoading(true);
    
    try {
      // Update current shift with opening balance
      if (shiftId) {
        await fetch(`/api/shifts/${shiftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openingBalance: amountValue }),
        });
      }
      
      // Log as transaction
      await fetch(`/api/companies/${companyId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          employeeId: employee?.id,
          type: "opening_float",
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
      console.error("Opening balance error:", err);
    } finally {
      setLoading(false);
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
  
  // Manager PIN verification screen
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
            <DollarSign className="h-10 w-10 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold">Register Management</h1>
          <p className="text-gray-400 mt-2">Enter manager PIN to continue</p>
        </motion.div>
        
        <div className="w-full max-w-xs">
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 p-4 bg-pos-card border border-pos-border rounded-lg">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full transition-colors ${
                    i < managerPin.length ? "bg-yellow-500" : "bg-gray-700"
                  }`}
                />
              ))}
            </div>
            {pinError && (
              <p className="text-red-400 text-center text-sm mt-2">{pinError}</p>
            )}
          </div>
          
          <NumericKeypad
            onKeyPress={(key) => managerPin.length < 6 && setManagerPin(managerPin + key)}
            onClear={() => setManagerPin("")}
            onBackspace={() => setManagerPin(managerPin.slice(0, -1))}
            onSubmit={verifyManagerPin}
            submitLabel={loading ? "..." : "Verify"}
          />
        </div>
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
        <div className="flex-1 flex items-center justify-center gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAction("opening")}
            className="p-8 bg-pos-card border border-pos-border rounded-lg hover:border-yellow-500/50 transition-colors"
          >
            <PiggyBank className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
            <p className="text-lg font-semibold">Set Opening Balance</p>
            <p className="text-sm text-gray-400">Start of shift drawer count</p>
          </motion.button>
          
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
          <h2 className="text-xl font-semibold mb-2">
            {action === "opening" ? "Opening Balance" : "Cash Injection"}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {action === "opening"
              ? "Enter the amount of cash in the drawer"
              : "Enter the amount being added to the drawer"}
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
            onSubmit={action === "opening" ? handleOpeningBalance : handleCashInjection}
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
