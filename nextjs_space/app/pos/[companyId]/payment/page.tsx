"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NumericKeypad } from "@/components/numeric-keypad";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { formatCurrency } from "@/lib/helpers";
import { ArrowLeft, CreditCard, Banknote, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CartData {
  items: any[];
  totals: { subtotal: number; tax: number; total: number };
  transactionId: string;
  employeeId: string;
  shiftId: string;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId } = usePOS();
  
  const [cartData, setCartData] = useState<CartData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | null>(null);
  const [cashGiven, setCashGiven] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    if (!employee) {
      router.push(`/pos/${companyId}/login`);
      return;
    }
    
    const stored = sessionStorage.getItem("pos_cart");
    if (!stored) {
      router.push(`/pos/${companyId}/transaction`);
      return;
    }
    
    try {
      setCartData(JSON.parse(stored));
    } catch {
      router.push(`/pos/${companyId}/transaction`);
    }
  }, [employee, companyId, router]);
  
  const total = cartData?.totals?.total ?? 0;
  const cashGivenAmount = parseFloat(cashGiven) || 0;
  const changeDue = Math.max(0, cashGivenAmount - total);
  
  const handleCashKeyPress = (key: string) => {
    if (key === "." && cashGiven.includes(".")) return;
    setCashGiven(cashGiven + key);
  };
  
  const handleQuickAmount = (amount: number) => {
    setCashGiven(amount.toString());
  };
  
  const canComplete = paymentMethod === "card" || cashGivenAmount >= total;
  
  const completeTransaction = async () => {
    if (!canComplete || !cartData) return;
    
    setProcessing(true);
    setError("");
    
    try {
      const transactionData = {
        employeeId: employee?.id,
        shiftId: shiftId,
        paymentMethod,
        cashGiven: paymentMethod === "cash" ? cashGivenAmount : null,
        items: (cartData.items ?? []).map((item) => ({
          itemId: item?.itemId,
          itemName: item?.name,
          quantity: item?.quantity,
          unitPrice: item?.price,
          isWeightItem: item?.isWeightPriced,
        })),
      };
      
      const res = await fetch(`/api/companies/${companyId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to complete transaction");
      }
      
      // Clear cart
      sessionStorage.removeItem("pos_cart");
      setSuccess(true);
      
      // Wait a moment to show success, then redirect
      setTimeout(() => {
        router.push(`/pos/${companyId}/transaction`);
      }, 2000);
    } catch (err: any) {
      console.error("Transaction error:", err);
      setError(err?.message ?? "Failed to complete transaction");
    } finally {
      setProcessing(false);
    }
  };
  
  if (!employee || !cartData) return null;
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-green-400">Transaction Complete!</h1>
          {paymentMethod === "cash" && changeDue > 0 && (
            <p className="text-2xl mt-4">
              Change Due: <span className="text-yellow-400 font-bold">{formatCurrency(changeDue)}</span>
            </p>
          )}
          <p className="text-gray-400 mt-4">Returning to transaction screen...</p>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      <Button
        variant="ghost"
        onClick={() => router.push(`/pos/${companyId}/transaction`)}
        className="self-start text-gray-400 hover:text-white mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {/* Total display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full p-6 bg-pos-card border border-pos-border rounded-lg text-center mb-6"
        >
          <p className="text-gray-400 mb-2">Total Due</p>
          <p className="text-5xl font-bold text-green-400">{formatCurrency(total)}</p>
        </motion.div>
        
        {/* Payment method selection */}
        {!paymentMethod && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full grid grid-cols-2 gap-4 mb-6"
          >
            <Button
              variant="pos"
              size="pos-large"
              className="flex flex-col gap-2 hover:border-green-500"
              onClick={() => setPaymentMethod("cash")}
            >
              <Banknote className="h-8 w-8 text-green-400" />
              <span>Cash</span>
            </Button>
            <Button
              variant="pos"
              size="pos-large"
              className="flex flex-col gap-2 hover:border-blue-500"
              onClick={() => setPaymentMethod("card")}
            >
              <CreditCard className="h-8 w-8 text-blue-400" />
              <span>Card</span>
            </Button>
          </motion.div>
        )}
        
        {/* Cash payment flow */}
        <AnimatePresence>
          {paymentMethod === "cash" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <div className="p-4 bg-pos-card border border-pos-border rounded-lg mb-4">
                <p className="text-gray-400 text-sm mb-1">Cash Given</p>
                <p className="text-3xl font-mono">{formatCurrency(cashGivenAmount)}</p>
              </div>
              
              {cashGivenAmount >= total && (
                <div className="p-4 bg-green-600/20 border border-green-600/30 rounded-lg mb-4">
                  <p className="text-sm text-green-400">Change Due</p>
                  <p className="text-3xl font-bold text-green-400">{formatCurrency(changeDue)}</p>
                </div>
              )}
              
              {/* Quick amount buttons */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[5, 10, 20, 50].map((amount) => (
                  <Button
                    key={amount}
                    variant="pos"
                    onClick={() => handleQuickAmount(amount)}
                    className="h-12"
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
              
              {/* Exact amount button */}
              <Button
                variant="pos"
                className="w-full mb-4 h-12"
                onClick={() => handleQuickAmount(Math.ceil(total))}
              >
                Exact: {formatCurrency(total)}
              </Button>
              
              <NumericKeypad
                onKeyPress={handleCashKeyPress}
                onClear={() => setCashGiven("")}
                onBackspace={() => setCashGiven(cashGiven.slice(0, -1))}
                showDecimal
              />
              
              <div className="flex gap-4 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 h-14 border-gray-600 text-gray-300"
                  onClick={() => setPaymentMethod(null)}
                >
                  Back
                </Button>
                <Button
                  variant="pos-success"
                  className="flex-1 h-14"
                  disabled={!canComplete || processing}
                  onClick={completeTransaction}
                >
                  {processing ? <LoadingSpinner size="sm" /> : "DONE"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Card payment flow */}
        <AnimatePresence>
          {paymentMethod === "card" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full text-center"
            >
              <div className="p-8 bg-pos-card border border-pos-border rounded-lg mb-6">
                <CreditCard className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                <p className="text-xl text-gray-300">Process card payment</p>
                <p className="text-gray-500 mt-2">Amount: {formatCurrency(total)}</p>
              </div>
              
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 h-14 border-gray-600 text-gray-300"
                  onClick={() => setPaymentMethod(null)}
                >
                  Back
                </Button>
                <Button
                  variant="pos-success"
                  className="flex-1 h-14"
                  disabled={processing}
                  onClick={completeTransaction}
                >
                  {processing ? <LoadingSpinner size="sm" /> : "DONE"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {error && (
          <p className="text-red-400 text-center mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}