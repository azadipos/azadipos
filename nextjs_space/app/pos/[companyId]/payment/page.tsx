"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NumericKeypad } from "@/components/numeric-keypad";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { formatCurrency } from "@/lib/helpers";
import { ArrowLeft, CreditCard, Banknote, CheckCircle, SplitSquareVertical, Printer, XCircle, AlertTriangle, RefreshCw, Wifi } from "lucide-react";
import { printReceipt } from "@/lib/receipt";
import { sendCardPayment, cancelCardPayment, isElectronHardwareAvailable, openCashDrawer } from "@/lib/hardware";
import type { CardPaymentResponse } from "@/lib/hardware";
import { motion, AnimatePresence } from "framer-motion";

interface CartData {
  items: any[];
  totals: { subtotal: number; tax: number; total: number; storeCreditTotal?: number; giftCardTotal?: number; grossTotal?: number; loyaltyRewardDiscount?: number; promotionSavings?: number };
  transactionId: string;
  employeeId: string;
  shiftId: string;
  appliedStoreCredits?: { barcode: string; amount: number }[];
  appliedGiftCards?: { barcode: string; amount: number; giftCardId: string }[];
  appliedReward?: { tier: any; discount: number; description: string; pointsRedeemed: number } | null;
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
  const [completedTxn, setCompletedTxn] = useState<any>(null);
  
  // Card terminal state
  const [cardStatus, setCardStatus] = useState<"idle" | "sending" | "waiting" | "approved" | "declined" | "error">("idle");
  const [cardResponse, setCardResponse] = useState<CardPaymentResponse | null>(null);
  const [terminalConnected] = useState(() => isElectronHardwareAvailable());
  
  // Split payment state
  const [splitStep, setSplitStep] = useState<1 | 2>(1);
  const [splitPayment1, setSplitPayment1] = useState<{ method: "cash" | "card"; amount: number } | null>(null);
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitMethod1, setSplitMethod1] = useState<"cash" | "card">("cash");
  
  // Store card data for receipt
  const [savedCardData, setSavedCardData] = useState<CardPaymentResponse | null>(null);
  
  // Cashback state
  const [cashbackAmount, setCashbackAmount] = useState("");
  
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
  
  // Send payment to card terminal
  const initiateCardPayment = async (amount?: number) => {
    const payAmount = amount || total;
    const cashback = parseFloat(cashbackAmount) || 0;
    setCardStatus("sending");
    setCardResponse(null);
    setError("");
    
    try {
      setCardStatus("waiting");
      const response = await sendCardPayment({
        amount: payAmount + cashback,
        cashbackAmount: cashback > 0 ? cashback : undefined,
        transactionId: cartData?.transactionId || "",
      });
      
      setCardResponse(response);
      
      if (response.success && response.approved) {
        setCardStatus("approved");
        setSavedCardData(response);
        return response;
      } else {
        setCardStatus("declined");
        return response;
      }
    } catch (err: any) {
      setCardStatus("error");
      setCardResponse({ success: false, approved: false, error: err?.message || "Terminal error" });
      return null;
    }
  };
  
  // Handle card payment complete flow
  const handleCardPayment = async () => {
    const response = await initiateCardPayment();
    if (response?.approved) {
      // Auto-complete transaction after approval
      await completeTransaction("card", response);
    }
  };
  
  // Retry card payment
  const retryCardPayment = () => {
    setCardStatus("idle");
    setCardResponse(null);
    setError("");
  };
  
  // Switch from declined card to different payment method
  const changePaymentMethod = () => {
    setPaymentMethod(null);
    setCardStatus("idle");
    setCardResponse(null);
    setError("");
  };
  
  const completeTransaction = async (method?: string, cardResp?: CardPaymentResponse | null) => {
    if (!cartData) return;
    
    const effectiveMethod = method || paymentMethod;
    const effectiveCardData = cardResp || savedCardData;
    
    setProcessing(true);
    setError("");
    
    try {
      const regularItems = (cartData.items ?? []).filter((item) => !item?.id?.startsWith("gc-"));
      const giftCardItemsToSell = (cartData.items ?? []).filter((item) => item?.id?.startsWith("gc-"));
      
      const transactionData = {
        employeeId: employee?.id,
        shiftId: shiftId,
        paymentMethod: effectiveMethod,
        cashGiven: effectiveMethod === "cash" ? cashGivenAmount : null,
        storeCreditApplied: cartData.totals?.storeCreditTotal || 0,
        giftCardApplied: cartData.totals?.giftCardTotal || 0,
        customerId: cartData.customer?.id || null,
        loyaltyPointsRedeemed: cartData.appliedReward?.pointsRedeemed || 0,
        loyaltyRewardDiscount: cartData.appliedReward?.discount || 0,
        // Card terminal data
        cardType: effectiveCardData?.cardType || null,
        cardLastFour: effectiveCardData?.lastFour || null,
        cardApprovalCode: effectiveCardData?.approvalCode || null,
        cardEntryMethod: effectiveCardData?.entryMethod || null,
        cardReferenceNumber: effectiveCardData?.referenceNumber || null,
        items: regularItems.map((item) => ({
          itemId: item?.itemId,
          itemName: item?.name,
          quantity: item?.quantity,
          unitPrice: item?.price,
          isWeightItem: item?.isWeightPriced,
        })),
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
      
      // Redeem applied store credits
      if (cartData.appliedStoreCredits && cartData.appliedStoreCredits.length > 0) {
        for (const credit of cartData.appliedStoreCredits) {
          try {
            await fetch("/api/store-credits/redeem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ barcode: credit.barcode, transactionId: txn.id }),
            });
          } catch (err) {
            console.error("Failed to redeem store credit:", credit.barcode, err);
          }
        }
      }
      
      // Redeem applied gift cards
      if (cartData.appliedGiftCards && cartData.appliedGiftCards.length > 0) {
        for (const giftCard of cartData.appliedGiftCards) {
          try {
            await fetch("/api/gift-cards/redeem", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                barcode: giftCard.barcode,
                amount: Math.min(giftCard.amount, total + (cartData.totals?.giftCardTotal || 0)),
                transactionId: txn.id,
              }),
            });
          } catch (err) {
            console.error("Failed to redeem gift card:", giftCard.barcode, err);
          }
        }
      }
      
      // Activate sold gift cards
      if (giftCardItemsToSell.length > 0) {
        for (const gc of giftCardItemsToSell) {
          try {
            await fetch(`/api/gift-cards/${gc.itemId}/activate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionId: txn.id }),
            });
          } catch (err) {
            console.error("Failed to activate gift card:", gc.itemId, err);
          }
        }
      }
      
      // Open cash drawer when change is due or cashback was given
      const hasCashBack = effectiveCardData?.cashbackAmount && effectiveCardData.cashbackAmount > 0;
      const hasChangeDue = effectiveMethod === "cash" && cashGivenAmount > total;
      if (hasChangeDue || hasCashBack) {
        openCashDrawer().catch(() => {}); // fire-and-forget
      }
      
      // Clear cart and draft
      sessionStorage.removeItem("pos_cart");
      sessionStorage.removeItem("pos_cart_draft");
      setCompletedTxn(txn);
      setSuccess(true);
      
      // Auto-print receipt with card data
      try {
        const companyRes = await fetch(`/api/companies/${companyId}/settings`);
        const company = companyRes.ok ? await companyRes.json() : { name: 'Store' };
        printReceipt({
          companyName: company.name || 'Store',
          address: company.address, phone: company.phone,
          logoUrl: company.logoUrl, receiptHeader: company.receiptHeader, receiptFooter: company.receiptFooter,
          transactionNumber: txn.transactionNumber,
          date: new Date().toLocaleString(),
          cashierName: txn.employee?.name || employee?.name || 'Staff',
          items: (txn.items || []).map((i: any) => ({
            name: i.itemName, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal, isWeightItem: i.isWeightItem,
          })),
          subtotal: txn.subtotal, tax: txn.tax, total: txn.total,
          loyaltyRewardDiscount: txn.loyaltyRewardDiscount || 0,
          paymentMethod: txn.paymentMethod || effectiveMethod || 'cash',
          cashGiven: txn.cashGiven, changeDue: txn.changeDue,
          customerName: cartData.customer?.name,
          loyaltyPointsEarned: txn.loyaltyPointsEarned,
          loyaltyPointsRedeemed: txn.loyaltyPointsRedeemed,
          cardData: effectiveCardData ? {
            cardType: effectiveCardData.cardType,
            lastFour: effectiveCardData.lastFour,
            approvalCode: effectiveCardData.approvalCode,
            referenceNumber: effectiveCardData.referenceNumber,
            entryMethod: effectiveCardData.entryMethod,
            cardholderName: effectiveCardData.cardholderName,
          } : null,
        });
      } catch (printErr) {
        console.error('Receipt print failed:', printErr);
      }
      
      setTimeout(() => {
        router.push(`/pos/${companyId}/transaction`);
      }, 4000);
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
          
          {/* Show cashback info */}
          {savedCardData?.cashbackAmount && savedCardData.cashbackAmount > 0 && (
            <p className="text-2xl mt-4">
              Cashback: <span className="text-green-400 font-bold">{formatCurrency(savedCardData.cashbackAmount)}</span>
            </p>
          )}
          
          {/* Show card info on success screen */}
          {savedCardData && savedCardData.lastFour && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg inline-block">
              <p className="text-blue-400 text-sm">
                {savedCardData.cardType || 'Card'} ****{savedCardData.lastFour}
                {savedCardData.approvalCode && ` • Auth: ${savedCardData.approvalCode}`}
              </p>
            </div>
          )}
          
          <Button
            variant="outline"
            className="mt-6 gap-2"
            onClick={() => {
              if (completedTxn && cartData) {
                fetch(`/api/companies/${companyId}/settings`)
                  .then(r => r.ok ? r.json() : { name: 'Store' })
                  .then(company => {
                    printReceipt({
                      companyName: company.name || 'Store',
                      address: company.address, phone: company.phone,
                      logoUrl: company.logoUrl, receiptHeader: company.receiptHeader, receiptFooter: company.receiptFooter,
                      transactionNumber: completedTxn.transactionNumber,
                      date: new Date(completedTxn.createdAt).toLocaleString(),
                      cashierName: completedTxn.employee?.name || employee?.name || 'Staff',
                      items: (completedTxn.items || []).map((i: any) => ({ name: i.itemName, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal, isWeightItem: i.isWeightItem })),
                      subtotal: completedTxn.subtotal, tax: completedTxn.tax, total: completedTxn.total,
                      loyaltyRewardDiscount: completedTxn.loyaltyRewardDiscount || 0,
                      paymentMethod: completedTxn.paymentMethod,
                      cashGiven: completedTxn.cashGiven, changeDue: completedTxn.changeDue,
                      customerName: cartData.customer?.name,
                      loyaltyPointsEarned: completedTxn.loyaltyPointsEarned,
                      loyaltyPointsRedeemed: completedTxn.loyaltyPointsRedeemed,
                      cardData: savedCardData ? {
                        cardType: savedCardData.cardType,
                        lastFour: savedCardData.lastFour,
                        approvalCode: savedCardData.approvalCode,
                        referenceNumber: savedCardData.referenceNumber,
                        entryMethod: savedCardData.entryMethod,
                        cardholderName: savedCardData.cardholderName,
                      } : null,
                    });
                  });
              }
            }}
          >
            <Printer className="h-4 w-4" /> Print Receipt Again
          </Button>
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
                  disabled={cashGivenAmount < total || processing}
                  onClick={() => completeTransaction("cash")}
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
              className="w-full"
            >
              {/* Idle - ready to send */}
              {cardStatus === "idle" && (
                <div className="text-center">
                  <div className="p-8 bg-pos-card border border-pos-border rounded-lg mb-6">
                    <CreditCard className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                    <p className="text-xl text-gray-300">Card Payment</p>
                    <p className="text-gray-500 mt-2">Amount: {formatCurrency(total)}</p>
                    {terminalConnected && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-sm">
                        <Wifi className="h-4 w-4" />
                        <span>Terminal Connected</span>
                      </div>
                    )}
                  </div>
                  {/* Cashback Option */}
                  <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Cashback (optional)</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xl text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={cashbackAmount}
                        onChange={(e) => setCashbackAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 h-12 px-4 text-xl font-mono bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    {parseFloat(cashbackAmount) > 0 && (
                      <p className="text-sm text-blue-400 mt-2">
                        Total charge: {formatCurrency(total + parseFloat(cashbackAmount))} 
                        (purchase {formatCurrency(total)} + cashback {formatCurrency(parseFloat(cashbackAmount))})
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      className="flex-1 h-14 border-gray-600 text-gray-300"
                      onClick={() => { setPaymentMethod(null); setCashbackAmount(""); }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="pos-success"
                      className="flex-1 h-14"
                      onClick={handleCardPayment}
                    >
                      {terminalConnected ? "Send to Terminal" : "Payment Received"}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Sending / Waiting for terminal response */}
              {(cardStatus === "sending" || cardStatus === "waiting") && (
                <div className="text-center">
                  <div className="p-8 bg-pos-card border border-blue-500/30 rounded-lg mb-6">
                    <div className="relative">
                      <CreditCard className="h-16 w-16 text-blue-400 mx-auto mb-4 animate-pulse" />
                    </div>
                    <p className="text-xl text-blue-300 font-medium">Processing Payment...</p>
                    <p className="text-gray-400 mt-2">{formatCurrency(total)}</p>
                    <p className="text-sm text-gray-500 mt-4">
                      {cardStatus === "sending" ? "Sending to terminal..." : "Waiting for customer to complete payment..."}
                    </p>
                    <div className="mt-4"><LoadingSpinner size="lg" /></div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full h-12 border-red-600/50 text-red-400 hover:bg-red-900/20"
                    onClick={async () => {
                      await cancelCardPayment();
                      setCardStatus("idle");
                      setCardResponse(null);
                    }}
                  >
                    Cancel Payment
                  </Button>
                </div>
              )}
              
              {/* Approved */}
              {cardStatus === "approved" && cardResponse && (
                <div className="text-center">
                  <div className="p-8 bg-green-900/20 border border-green-600/30 rounded-lg mb-6">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="text-xl text-green-400 font-bold">APPROVED</p>
                    <div className="mt-4 space-y-1 text-sm">
                      {cardResponse.cardType && (
                        <p className="text-gray-300">{cardResponse.cardType} ****{cardResponse.lastFour}</p>
                      )}
                      {cardResponse.approvalCode && (
                        <p className="text-gray-400">Auth: {cardResponse.approvalCode}</p>
                      )}
                      {cardResponse.entryMethod && (
                        <p className="text-gray-500 capitalize">{cardResponse.entryMethod}</p>
                      )}
                    </div>
                  </div>
                  {processing && (
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <LoadingSpinner size="sm" />
                      <span>Completing transaction...</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Declined */}
              {cardStatus === "declined" && cardResponse && (
                <div className="text-center">
                  <div className="p-8 bg-red-900/20 border border-red-600/30 rounded-lg mb-6">
                    <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-xl text-red-400 font-bold">DECLINED</p>
                    {cardResponse.declineReason && (
                      <p className="text-red-300 mt-2">{cardResponse.declineReason}</p>
                    )}
                    {cardResponse.error && (
                      <p className="text-red-300 mt-2">{cardResponse.error}</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Button
                      variant="pos"
                      className="w-full h-14 border-blue-500/50 hover:border-blue-400"
                      onClick={retryCardPayment}
                    >
                      <RefreshCw className="h-5 w-5 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-12 border-gray-600 text-gray-300"
                      onClick={changePaymentMethod}
                    >
                      Choose Different Payment Method
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Terminal Error */}
              {cardStatus === "error" && (
                <div className="text-center">
                  <div className="p-8 bg-orange-900/20 border border-orange-600/30 rounded-lg mb-6">
                    <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
                    <p className="text-xl text-orange-400 font-bold">Terminal Error</p>
                    <p className="text-gray-400 mt-2">
                      {cardResponse?.error || "Could not communicate with card terminal"}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Button
                      variant="pos"
                      className="w-full h-14 border-blue-500/50"
                      onClick={retryCardPayment}
                    >
                      <RefreshCw className="h-5 w-5 mr-2" />
                      Retry
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-12 border-gray-600 text-gray-300"
                      onClick={changePaymentMethod}
                    >
                      Choose Different Payment Method
                    </Button>
                  </div>
                </div>
              )}
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
                        setCashGiven((total - splitPayment1.amount).toString());
                      }}
                      className="p-4 rounded-lg border border-gray-700 hover:border-green-500 flex flex-col items-center gap-2"
                    >
                      <Banknote className="h-8 w-8 text-green-400" />
                      Cash
                    </button>
                    <button
                      onClick={async () => {
                        setProcessing(true);
                        try {
                          const transactionData = {
                            employeeId: employee?.id,
                            shiftId: shiftId,
                            paymentMethod: "split",
                            cashGiven: splitPayment1.method === "cash" ? splitPayment1.amount : null,
                            customerId: cartData?.customer?.id || null,
                            loyaltyPointsRedeemed: cartData?.appliedReward?.pointsRedeemed || 0,
                            loyaltyRewardDiscount: cartData?.appliedReward?.discount || 0,
                            items: (cartData?.items ?? []).filter((item) => !item?.id?.startsWith("gc-")).map((item) => ({
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
                          sessionStorage.removeItem("pos_cart_draft");
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
                              customerId: cartData?.customer?.id || null,
                              loyaltyPointsRedeemed: cartData?.appliedReward?.pointsRedeemed || 0,
                              loyaltyRewardDiscount: cartData?.appliedReward?.discount || 0,
                              items: (cartData?.items ?? []).filter((item) => !item?.id?.startsWith("gc-")).map((item) => ({
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
                            sessionStorage.removeItem("pos_cart_draft");
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
