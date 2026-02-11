"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NumericKeypad } from "@/components/numeric-keypad";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { formatCurrency } from "@/lib/helpers";
import { ArrowLeft, CreditCard, Banknote, CheckCircle, SplitSquareVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CartData {
  items: any[];
  totals: { subtotal: number; tax: number; total: number; storeCreditTotal?: number; giftCardTotal?: number; grossTotal?: number };
  transactionId: string;
  employeeId: string;
  shiftId: string;
  appliedStoreCredits?: { barcode: string; amount: number }[];
  appliedGiftCards?: { barcode: string; amount: number; giftCardId: string }[];
  customer?: { id: string; name: string; phone: string; loyaltyPoints: number } | null;
}

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId } = usePOS();
  
  const [cartData, setCartData] = useState<CartData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "split" | null>(null);
  const [cashGiven, setCashGiven] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  // Split payment state
  const [splitStep, setSplitStep] = useState<1 | 2>(1);
  const [splitPayment1, setSplitPayment1] = useState<{ method: "cash" | "card"; amount: number } | null>(null);
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitMethod1, setSplitMethod1] = useState<"cash" | "card">("cash");
  
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
      // Filter out gift card items from regular items (they start with "gc-")
      const regularItems = (cartData.items ?? []).filter((item) => !item?.id?.startsWith("gc-"));
      const giftCardItemsToSell = (cartData.items ?? []).filter((item) => item?.id?.startsWith("gc-"));
      
      const transactionData = {
        employeeId: employee?.id,
        shiftId: shiftId,
        paymentMethod,
        cashGiven: paymentMethod === "cash" ? cashGivenAmount : null,
        storeCreditApplied: cartData.totals?.storeCreditTotal || 0,
        giftCardApplied: cartData.totals?.giftCardTotal || 0,
        customerId: cartData.customer?.id || null,
        items: regularItems.map((item) => ({
          itemId: item?.itemId,
          itemName: item?.name,
          quantity: item?.quantity,
          unitPrice: item?.price,
          isWeightItem: item?.isWeightPriced,
        })),
        // Include gift card sales as separate items
        giftCardSales: giftCardItemsToSell.map((gc) => ({
          giftCardId: gc?.itemId,
          amount: gc?.price,
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
      
      const txn = await res.json();
      
      // Redeem any applied store credits
      if (cartData.appliedStoreCredits && cartData.appliedStoreCredits.length > 0) {
        for (const credit of cartData.appliedStoreCredits) {
          try {
            await fetch("/api/store-credits/redeem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                barcode: credit.barcode,
                transactionId: txn.id,
              }),
            });
          } catch (err) {
            console.error("Failed to redeem store credit:", credit.barcode, err);
          }
        }
      }
      
      // Redeem any applied gift cards (deduct from their balance)
      if (cartData.appliedGiftCards && cartData.appliedGiftCards.length > 0) {
        for (const giftCard of cartData.appliedGiftCards) {
          try {
            await fetch("/api/gift-cards/redeem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                barcode: giftCard.barcode,
                amount: Math.min(giftCard.amount, total + (cartData.totals?.giftCardTotal || 0)), // Don't redeem more than needed
                transactionId: txn.id,
              }),
            });
          } catch (err) {
            console.error("Failed to redeem gift card:", giftCard.barcode, err);
          }
        }
      }
      
      // Mark sold gift cards as purchased
      if (giftCardItemsToSell.length > 0) {
        for (const gc of giftCardItemsToSell) {
          try {
            await fetch(`/api/gift-cards/${gc.itemId}/activate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transactionId: txn.id,
              }),
            });
          } catch (err) {
            console.error("Failed to activate gift card:", gc.itemId, err);
          }
        }
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
            className="w-full space-y-4 mb-6"
          >
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <Button
              variant="pos"
              size="pos-large"
              className="w-full flex flex-col gap-2 hover:border-purple-500"
              onClick={() => setPaymentMethod("split")}
            >
              <SplitSquareVertical className="h-8 w-8 text-purple-400" />
              <span>Split Payment</span>
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
                onClick={() => setCashGiven(total.toFixed(2))}
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
                <p className="text-xl text-gray-300">Follow instructions on Pin Pad</p>
                <p className="text-gray-500 mt-2">Amount: {formatCurrency(total)}</p>
                <p className="text-xs text-gray-600 mt-4">
                  (In production, this will communicate with the Ingenico terminal)
                </p>
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
                  {processing ? <LoadingSpinner size="sm" /> : "Payment Received"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Split payment flow */}
        <AnimatePresence>
          {paymentMethod === "split" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <div className="mb-4 p-4 bg-pos-card border border-pos-border rounded-lg">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {splitPayment1 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Payment 1 ({splitPayment1.method})</span>
                    <span>-{formatCurrency(splitPayment1.amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold mt-2 pt-2 border-t border-pos-border">
                  <span>Remaining</span>
                  <span className="text-yellow-400">
                    {formatCurrency(total - (splitPayment1?.amount || 0))}
                  </span>
                </div>
              </div>
              
              {splitStep === 1 && !splitPayment1 && (
                <div className="space-y-4">
                  <p className="text-center text-gray-400">Payment 1</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => setSplitMethod1("cash")}
                      className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${splitMethod1 === "cash" ? "border-green-500 bg-green-500/20" : "border-gray-700"}`}
                    >
                      <Banknote className="h-5 w-5" />
                      Cash
                    </button>
                    <button
                      onClick={() => setSplitMethod1("card")}
                      className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${splitMethod1 === "card" ? "border-blue-500 bg-blue-500/20" : "border-gray-700"}`}
                    >
                      <CreditCard className="h-5 w-5" />
                      Card
                    </button>
                  </div>
                  
                  <div className="p-4 bg-pos-card border border-pos-border rounded-lg">
                    <p className="text-gray-400 text-sm mb-1">Amount</p>
                    <p className="text-3xl font-mono">{formatCurrency(parseFloat(splitAmount1) || 0)}</p>
                  </div>
                  
                  <NumericKeypad
                    onKeyPress={(key) => {
                      if (key === "." && splitAmount1.includes(".")) return;
                      setSplitAmount1(splitAmount1 + key);
                    }}
                    onClear={() => setSplitAmount1("")}
                    onBackspace={() => setSplitAmount1(splitAmount1.slice(0, -1))}
                    showDecimal
                  />
                  
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      className="flex-1 h-14 border-gray-600 text-gray-300"
                      onClick={() => {
                        setPaymentMethod(null);
                        setSplitStep(1);
                        setSplitPayment1(null);
                        setSplitAmount1("");
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="pos"
                      className="flex-1 h-14"
                      disabled={!splitAmount1 || parseFloat(splitAmount1) <= 0 || parseFloat(splitAmount1) >= total}
                      onClick={() => {
                        setSplitPayment1({
                          method: splitMethod1,
                          amount: parseFloat(splitAmount1),
                        });
                        setSplitStep(2);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
              
              {splitStep === 2 && splitPayment1 && (
                <div className="space-y-4">
                  <p className="text-center text-gray-400">
                    Payment 2 - Remaining: {formatCurrency(total - splitPayment1.amount)}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => {
                        // Process cash for remaining
                        setCashGiven((total - splitPayment1.amount).toString());
                      }}
                      className="p-4 rounded-lg border border-gray-700 hover:border-green-500 flex flex-col items-center gap-2"
                    >
                      <Banknote className="h-8 w-8 text-green-400" />
                      Cash
                    </button>
                    <button
                      onClick={async () => {
                        // Process card for remaining - complete transaction
                        setProcessing(true);
                        try {
                          const transactionData = {
                            employeeId: employee?.id,
                            shiftId: shiftId,
                            paymentMethod: "split",
                            cashGiven: splitPayment1.method === "cash" ? splitPayment1.amount : null,
                            items: (cartData?.items ?? []).map((item) => ({
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
                          
                          if (!res.ok) throw new Error("Failed");
                          
                          sessionStorage.removeItem("pos_cart");
                          setSuccess(true);
                          setTimeout(() => router.push(`/pos/${companyId}/transaction`), 2000);
                        } catch (err) {
                          setError("Failed to complete transaction");
                        } finally {
                          setProcessing(false);
                        }
                      }}
                      className="p-4 rounded-lg border border-gray-700 hover:border-blue-500 flex flex-col items-center gap-2"
                    >
                      <CreditCard className="h-8 w-8 text-blue-400" />
                      Card
                    </button>
                  </div>
                  
                  {parseFloat(cashGiven) > 0 && (
                    <div className="space-y-4">
                      <div className="p-4 bg-pos-card border border-pos-border rounded-lg">
                        <p className="text-gray-400 text-sm mb-1">Cash for Payment 2</p>
                        <p className="text-3xl font-mono">{formatCurrency(parseFloat(cashGiven))}</p>
                      </div>
                      
                      {parseFloat(cashGiven) >= (total - splitPayment1.amount) && (
                        <div className="p-4 bg-green-600/20 border border-green-600/30 rounded-lg">
                          <p className="text-sm text-green-400">Change Due</p>
                          <p className="text-2xl font-bold text-green-400">
                            {formatCurrency(parseFloat(cashGiven) - (total - splitPayment1.amount))}
                          </p>
                        </div>
                      )}
                      
                      <Button
                        variant="pos-success"
                        className="w-full h-14"
                        disabled={processing || parseFloat(cashGiven) < (total - splitPayment1.amount)}
                        onClick={async () => {
                          setProcessing(true);
                          try {
                            const transactionData = {
                              employeeId: employee?.id,
                              shiftId: shiftId,
                              paymentMethod: "split",
                              cashGiven: (splitPayment1.method === "cash" ? splitPayment1.amount : 0) + parseFloat(cashGiven),
                              items: (cartData?.items ?? []).map((item) => ({
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
                            
                            if (!res.ok) throw new Error("Failed");
                            
                            sessionStorage.removeItem("pos_cart");
                            setSuccess(true);
                            setTimeout(() => router.push(`/pos/${companyId}/transaction`), 2000);
                          } catch (err) {
                            setError("Failed to complete transaction");
                          } finally {
                            setProcessing(false);
                          }
                        }}
                      >
                        {processing ? <LoadingSpinner size="sm" /> : "Complete Transaction"}
                      </Button>
                    </div>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setSplitStep(1);
                      setSplitPayment1(null);
                      setSplitAmount1("");
                      setCashGiven("");
                    }}
                  >
                    Start Over
                  </Button>
                </div>
              )}
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