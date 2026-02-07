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
  Search,
  AlertCircle,
  Check,
  CreditCard,
  Banknote,
  Gift,
} from "lucide-react";
import { motion } from "framer-motion";

interface Transaction {
  id: string;
  transactionNumber: string;
  type: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: {
    id: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    isWeightItem: boolean;
  }[];
}

interface RefundItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isWeightItem: boolean;
  refundQty: number;
}

export default function RefundPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId } = usePOS();
  
  const [transactionId, setTransactionId] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"search" | "select" | "method" | "complete">("search");
  
  const [refundMethod, setRefundMethod] = useState<"original" | "cash" | "store_credit">("original");
  const [managerPinModal, setManagerPinModal] = useState(false);
  const [managerPin, setManagerPin] = useState("");
  const [authorizedManagerId, setAuthorizedManagerId] = useState<string | null>(null);
  
  const [storeCreditBarcode, setStoreCreditBarcode] = useState("");
  
  useEffect(() => {
    if (!employee) {
      router.push(`/pos/${companyId}/login`);
    }
  }, [employee, companyId, router]);
  
  const searchTransaction = async () => {
    if (!transactionId.trim()) {
      setError("Enter a transaction ID");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/transactions/search?companyId=${companyId}&transactionNumber=${encodeURIComponent(transactionId)}`);
      
      if (!res.ok) {
        setError("Transaction not found");
        return;
      }
      
      const txn = await res.json();
      
      // Check if already refunded
      if (txn.type === "refund" || txn.status === "refunded") {
        setError("This transaction has already been refunded");
        return;
      }
      
      // Check return period (would need category info)
      const txnDate = new Date(txn.createdAt);
      const daysSince = Math.floor((Date.now() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Default 30 day return period
      if (daysSince > 30) {
        setError("Transaction is outside the return period");
        return;
      }
      
      setTransaction(txn);
      setRefundItems(
        txn.items.map((item: any) => ({
          ...item,
          refundQty: item.quantity,
        }))
      );
      setStep("select");
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search transaction");
    } finally {
      setLoading(false);
    }
  };
  
  const updateRefundQty = (itemId: string, qty: number) => {
    setRefundItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const maxQty = transaction?.items.find((i) => i.id === itemId)?.quantity || item.quantity;
          return { ...item, refundQty: Math.max(0, Math.min(qty, maxQty)) };
        }
        return item;
      })
    );
  };
  
  const calculateRefundTotal = () => {
    let subtotal = 0;
    refundItems.forEach((item) => {
      subtotal += item.unitPrice * item.refundQty;
    });
    
    const taxRate = transaction ? (transaction.tax / transaction.subtotal) || 0 : 0;
    const tax = subtotal * taxRate;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  };
  
  const refundTotals = calculateRefundTotal();
  
  const hasItemsToRefund = refundItems.some((item) => item.refundQty > 0);
  
  const proceedToMethod = () => {
    if (!hasItemsToRefund) {
      setError("Select items to refund");
      return;
    }
    
    // For store credit, require manager PIN
    setManagerPinModal(true);
  };
  
  const verifyManagerPin = async () => {
    if (managerPin.length < 4) return;
    
    try {
      const res = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, pin: managerPin, requireManager: true }),
      });
      
      if (!res.ok) {
        setError("Invalid manager PIN");
        setManagerPin("");
        return;
      }
      
      const manager = await res.json();
      setAuthorizedManagerId(manager.id);
      setManagerPinModal(false);
      setManagerPin("");
      setStep("method");
    } catch (err) {
      console.error("PIN verification error:", err);
      setError("Failed to verify PIN");
    }
  };
  
  const processRefund = async () => {
    if (!transaction || !authorizedManagerId) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Create refund transaction
      const refundTxnRes = await fetch(`/api/companies/${companyId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          employeeId: employee?.id,
          type: "refund",
          subtotal: -refundTotals.subtotal,
          tax: -refundTotals.tax,
          total: -refundTotals.total,
          paymentMethod: refundMethod === "original" ? transaction.paymentMethod : refundMethod === "store_credit" ? "store_credit" : "cash",
          linkedTransactionId: transaction.id,
          authorizedByEmployeeId: authorizedManagerId,
          items: refundItems
            .filter((item) => item.refundQty > 0)
            .map((item) => ({
              itemId: item.id.split("-")[0], // Extract actual item ID
              itemName: item.itemName,
              quantity: -item.refundQty,
              unitPrice: item.unitPrice,
              lineTotal: -(item.unitPrice * item.refundQty),
              isWeightItem: item.isWeightItem,
            })),
        }),
      });
      
      if (!refundTxnRes.ok) {
        throw new Error("Failed to create refund transaction");
      }
      
      const refundTxn = await refundTxnRes.json();
      
      // If store credit, generate the credit
      if (refundMethod === "store_credit") {
        const creditRes = await fetch("/api/store-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            amount: refundTotals.total,
            transactionId: refundTxn.id,
          }),
        });
        
        if (creditRes.ok) {
          const credit = await creditRes.json();
          setStoreCreditBarcode(credit.barcode);
        }
      }
      
      // Mark original transaction as refunded
      await fetch(`/api/transactions/${transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "refunded" }),
      });
      
      setStep("complete");
    } catch (err) {
      console.error("Refund error:", err);
      setError("Failed to process refund");
    } finally {
      setLoading(false);
    }
  };
  
  if (!employee) return null;
  
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
        <h1 className="text-xl font-bold">Process Refund</h1>
        <div className="w-24" />
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-red-200">{error}</span>
        </div>
      )}
      
      {/* Step 1: Search */}
      {step === "search" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full"
        >
          <Search className="h-16 w-16 text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Find Transaction</h2>
          <p className="text-gray-400 text-center mb-6">
            Enter the transaction ID from the customer's receipt
          </p>
          
          <div className="w-full space-y-4">
            <Input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Transaction ID (e.g., TXN-20250207-123456)"
              className="h-14 text-lg"
              onKeyDown={(e) => e.key === "Enter" && searchTransaction()}
            />
            
            <Button
              variant="pos-success"
              size="pos-large"
              className="w-full"
              onClick={searchTransaction}
              disabled={loading}
            >
              {loading ? <LoadingSpinner size="sm" /> : "Search"}
            </Button>
          </div>
        </motion.div>
      )}
      
      {/* Step 2: Select Items */}
      {step === "select" && transaction && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex gap-4"
        >
          <div className="flex-1">
            <div className="mb-4">
              <h2 className="font-semibold">Original Transaction</h2>
              <p className="text-sm text-gray-400">
                {transaction.transactionNumber} • {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
            
            <div className="space-y-2">
              {refundItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-pos-card border border-pos-border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{item.itemName}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.unitPrice)} × {item.quantity}
                        {item.isWeightItem ? " lb" : ""}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Refund Qty:</span>
                      <Input
                        type="number"
                        min="0"
                        max={item.quantity}
                        step={item.isWeightItem ? "0.01" : "1"}
                        value={item.refundQty}
                        onChange={(e) => updateRefundQty(item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 text-center"
                      />
                    </div>
                    
                    <div className="w-24 text-right">
                      <p className="font-semibold text-red-400">
                        -{formatCurrency(item.unitPrice * item.refundQty)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="w-64">
            <div className="p-4 bg-pos-card border border-pos-border rounded-lg">
              <h3 className="font-semibold text-gray-400 mb-4">Refund Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span className="text-red-400">-{formatCurrency(refundTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Tax</span>
                  <span className="text-red-400">-{formatCurrency(refundTotals.tax)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t border-pos-border pt-3">
                  <span>REFUND</span>
                  <span className="text-red-400">-{formatCurrency(refundTotals.total)}</span>
                </div>
              </div>
              
              <Button
                variant="pos"
                size="pos-large"
                className="w-full mt-4"
                onClick={proceedToMethod}
                disabled={!hasItemsToRefund}
              >
                Continue
              </Button>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Step 3: Select Method */}
      {step === "method" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full"
        >
          <h2 className="text-xl font-semibold mb-6">Refund Method</h2>
          <p className="text-gray-400 mb-6">Total: <span className="text-red-400 font-bold">{formatCurrency(refundTotals.total)}</span></p>
          
          <div className="w-full space-y-3">
            <button
              onClick={() => setRefundMethod("original")}
              className={`w-full p-4 rounded-lg border flex items-center gap-4 transition-colors ${
                refundMethod === "original"
                  ? "border-blue-500 bg-blue-500/20"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              {transaction?.paymentMethod === "card" ? (
                <CreditCard className="h-6 w-6" />
              ) : (
                <Banknote className="h-6 w-6" />
              )}
              <div className="text-left">
                <p className="font-medium">Original Payment Method</p>
                <p className="text-sm text-gray-400">
                  Refund to {transaction?.paymentMethod === "card" ? "card" : "cash"}
                </p>
              </div>
            </button>
            
            <button
              onClick={() => setRefundMethod("cash")}
              className={`w-full p-4 rounded-lg border flex items-center gap-4 transition-colors ${
                refundMethod === "cash"
                  ? "border-blue-500 bg-blue-500/20"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              <Banknote className="h-6 w-6" />
              <div className="text-left">
                <p className="font-medium">Cash Refund</p>
                <p className="text-sm text-gray-400">Give cash from drawer</p>
              </div>
            </button>
            
            <button
              onClick={() => setRefundMethod("store_credit")}
              className={`w-full p-4 rounded-lg border flex items-center gap-4 transition-colors ${
                refundMethod === "store_credit"
                  ? "border-blue-500 bg-blue-500/20"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              <Gift className="h-6 w-6" />
              <div className="text-left">
                <p className="font-medium">Store Credit</p>
                <p className="text-sm text-gray-400">Generate store credit barcode</p>
              </div>
            </button>
          </div>
          
          <Button
            variant="pos-success"
            size="pos-large"
            className="w-full mt-6"
            onClick={processRefund}
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : "Process Refund"}
          </Button>
        </motion.div>
      )}
      
      {/* Step 4: Complete */}
      {step === "complete" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center"
        >
          <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mb-4">
            <Check className="h-10 w-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Refund Complete</h2>
          <p className="text-gray-400 mb-6">
            {formatCurrency(refundTotals.total)} refunded via {refundMethod === "store_credit" ? "store credit" : refundMethod}
          </p>
          
          {storeCreditBarcode && (
            <div className="p-6 bg-pos-card border border-pos-border rounded-lg mb-6 text-center">
              <p className="text-sm text-gray-400 mb-2">Store Credit Barcode</p>
              <p className="text-2xl font-mono font-bold text-yellow-400">{storeCreditBarcode}</p>
              <p className="text-sm text-gray-500 mt-2">Print receipt with barcode for customer</p>
            </div>
          )}
          
          <Button
            variant="pos"
            size="pos-large"
            onClick={() => router.push(`/pos/${companyId}/menu`)}
          >
            Return to Menu
          </Button>
        </motion.div>
      )}
      
      {/* Manager PIN Modal */}
      <Modal
        isOpen={managerPinModal}
        onClose={() => {
          setManagerPinModal(false);
          setManagerPin("");
        }}
        title="Manager Authorization Required"
      >
        <div className="text-center">
          <p className="text-gray-400 mb-4">Enter manager PIN to authorize refund</p>
          
          <div className="flex justify-center gap-3 mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full transition-colors ${
                  i < managerPin.length ? "bg-green-500" : "bg-gray-700"
                }`}
              />
            ))}
          </div>
          
          <NumericKeypad
            onKeyPress={(key) => managerPin.length < 6 && setManagerPin(managerPin + key)}
            onClear={() => setManagerPin("")}
            onBackspace={() => setManagerPin(managerPin.slice(0, -1))}
            onSubmit={verifyManagerPin}
            submitLabel="Authorize"
          />
        </div>
      </Modal>
    </div>
  );
}
