"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { User, Barcode, ArrowLeft, ScanLine } from "lucide-react";
import { motion } from "framer-motion";

export default function POSLoginPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { setCompanyId, setEmployee, setShiftId } = usePOS();
  
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastInputTime, setLastInputTime] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    setCompanyId(companyId);
  }, [companyId, setCompanyId]);
  
  // Auto-focus barcode input
  useEffect(() => {
    if (inputRef.current && !loading) {
      inputRef.current.focus();
    }
  }, [loading]);
  
  // Refocus on click anywhere
  useEffect(() => {
    const handleClick = () => {
      if (inputRef.current && !loading) {
        inputRef.current.focus();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [loading]);
  
  const handleLogin = async (scannedBarcode?: string) => {
    const barcodeToUse = scannedBarcode || barcode;
    
    if (!barcodeToUse.trim()) {
      setError("Please scan your employee barcode");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, barcode: barcodeToUse }),
      });
      
      if (!res.ok) {
        setError("Invalid employee barcode");
        setBarcode("");
        return;
      }
      
      const employee = await res.json();
      setEmployee(employee);
      
      // Create or get existing shift
      const shiftRes = await fetch(`/api/companies/${companyId}/shifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      
      if (shiftRes.ok) {
        const shift = await shiftRes.json();
        setShiftId(shift.id);
      }
      
      router.push(`/pos/${companyId}/menu`);
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const now = Date.now();
    
    setBarcode(value);
    setError("");
    
    // Detect fast input (scanner) vs manual typing
    // If multiple characters entered quickly, it's likely a scanner
    if (value.length > barcode.length + 1 || (now - lastInputTime < 50 && value.length > 5)) {
      // Auto-submit on scanner input
      if (value.startsWith("EMP-") && value.length >= 9) {
        setTimeout(() => handleLogin(value), 100);
      }
    }
    
    setLastInputTime(now);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && barcode.trim()) {
      handleLogin();
    }
  };
  
  // Handle paste (scanner often pastes)
  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData("text").trim();
    if (pastedText.startsWith("EMP-")) {
      e.preventDefault();
      setBarcode(pastedText);
      setTimeout(() => handleLogin(pastedText), 100);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Button
        variant="ghost"
        onClick={() => router.push("/pos")}
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
          <User className="h-10 w-10 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold">Employee Login</h1>
        <p className="text-gray-400 mt-2">Scan your employee barcode to clock in</p>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md"
      >
        <div className="mb-6">
          <div className="relative">
            <div className="p-8 bg-pos-card border-2 border-dashed border-pos-border rounded-xl flex flex-col items-center gap-4">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-green-400"
              >
                <ScanLine className="h-16 w-16" />
              </motion.div>
              <p className="text-gray-400 text-sm">Waiting for barcode scan...</p>
              
              <Input
                ref={inputRef}
                value={barcode}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Scan or enter employee barcode"
                className="bg-gray-800 border-gray-600 text-white text-center font-mono text-lg tracking-wider"
                autoComplete="off"
              />
              
              {barcode && (
                <div className="flex items-center gap-2 text-green-400">
                  <Barcode className="h-5 w-5" />
                  <span className="font-mono">{barcode}</span>
                </div>
              )}
            </div>
          </div>
          
          {error && (
            <p className="text-red-400 text-center text-sm mt-4">{error}</p>
          )}
        </div>
        
        <Button
          onClick={() => handleLogin()}
          disabled={loading || !barcode.trim()}
          className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-700"
        >
          {loading ? <LoadingSpinner size="sm" /> : "Clock In"}
        </Button>
        
        <p className="text-center text-gray-500 text-xs mt-4">
          Don&apos;t have your barcode? Contact a manager to print a new one.
        </p>
      </motion.div>
    </div>
  );
}