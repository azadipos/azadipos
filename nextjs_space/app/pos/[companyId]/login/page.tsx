"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NumericKeypad } from "@/components/numeric-keypad";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { User, Lock, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function POSLoginPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { setCompanyId, setEmployee, setShiftId } = usePOS();
  
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setCompanyId(companyId);
  }, [companyId, setCompanyId]);
  
  const handleKeyPress = (key: string) => {
    if (pin.length < 6) {
      setPin(pin + key);
      setError("");
    }
  };
  
  const handleClear = () => {
    setPin("");
    setError("");
  };
  
  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };
  
  const handleLogin = async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, pin }),
      });
      
      if (!res.ok) {
        setError("Invalid PIN");
        setPin("");
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
        <p className="text-gray-400 mt-2">Enter your PIN to clock in</p>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-xs"
      >
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 p-4 bg-pos-card border border-pos-border rounded-lg">
            <Lock className="h-5 w-5 text-gray-500" />
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full transition-colors ${
                    i < pin.length ? "bg-green-500" : "bg-gray-700"
                  }`}
                />
              ))}
            </div>
          </div>
          {error && (
            <p className="text-red-400 text-center text-sm mt-2">{error}</p>
          )}
        </div>
        
        <NumericKeypad
          onKeyPress={handleKeyPress}
          onClear={handleClear}
          onBackspace={handleBackspace}
          onSubmit={handleLogin}
          submitLabel={loading ? "..." : "Login"}
        />
      </motion.div>
    </div>
  );
}