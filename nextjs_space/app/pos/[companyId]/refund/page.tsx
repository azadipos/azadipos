"use client";

import { useState, useEffect, useRef } from "react";
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
  FileQuestion,
  ScanLine,
  Ban,
  Clock,
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
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    isWeightItem: boolean;
  }[];
}

interface RefundItem {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isWeightItem: boolean;
  refundQty: number;
  policyError?: string;
  canReturn: boolean;
}

export default function RefundPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId } = usePOS();
  
  // Mode selection: "receipt" or "no_receipt"
  const [mode, setMode] = useState<"select" | "receipt" | "no_receipt">("select");
  
  const [transactionId, setTransactionId] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [policyWarning, setPolicyWarning] = useState("");
  const [step, setStep] = useState<"search" | "select" | "method" | "amount" | "complete">("search");
  
  const [refundMethod, setRefundMethod] = useState<"original" | "cash" | "store_credit">("original");
  const [managerBarcodeModal, setManagerBarcodeModal] = useState(false);
  const [managerBarcode, setManagerBarcode] = useState("");
  const [authorizedManagerId, setAuthorizedManagerId] = useState<string | null>(null);
  const managerBarcodeRef = useRef<HTMLInputElement>(null);
  
  // No-receipt store credit amount
  const [noReceiptAmount, setNoReceiptAmount] = useState("");
  const [noReceiptDescription, setNoReceiptDescription] = useState("");
  
  const [storeCreditBarcode, setStoreCreditBarcode] = useState("");
  
  // Transaction input ref for barcode scanning
  const transactionInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!employee) {
      router.push(`/pos/${companyId}/login`);
    }
  }, [employee, companyId, router]);
  
  // Auto-focus manager barcode input when modal opens
  useEffect(() => {
    if (managerBarcodeModal && managerBarcodeRef.current) {
      managerBarcodeRef.current.focus();
    }
  }, [managerBarcodeModal]);
  
  const searchTransaction = async () => {
    if (!transactionId.trim()) {
      setError("Enter a transaction ID or scan receipt");
      return;
    }
    
    setLoading(true);
    setError("");
    setPolicyWarning("");
    
    try {
      const res = await fetch(`/api/transactions/search?companyId=${companyId}&transactionNumber=${encodeURIComponent(transactionId)}`);
      
      if (!res.ok) {
        setError("Transaction not found");
        return;
      }
      
      const txn = await res.json();
      
      // Validate transaction against policy
      const policyRes = await fetch("/api/policies/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, transactionId: txn.id }),
      });
      
      const policyResult = await policyRes.json();
      
      if (!policyResult.allowed) {
        setError(policyResult.reason);
        return;
      }
      
      // Show warning if close to return period limit
      if (policyResult.daysSincePurchase > policyResult.maxDays * 0.8) {
        setPolicyWarning(
          `This transaction is ${policyResult.daysSincePurchase} days old (${policyResult.maxDays} day limit)`
        );
      }
      
      setTransaction(txn);
      
      // Validate each item's return policy
      const itemsWithPolicy = await Promise.all(
        txn.items.map(async (item: any) => {
          const itemPolicyRes = await fetch("/api/policies/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId, itemId: item.itemId }),
          });
          
          const itemPolicy = await itemPolicyRes.json();
          
          // Check if item-specific return period is exceeded
          let canReturn = itemPolicy.allowed;
          let policyError = "";
          
          if (itemPolicy.isNonReturnable) {
            canReturn = false;
            policyError = "Non-returnable item";
          } else if (itemPolicy.effectiveReturnPeriod && policyResult.daysSincePurchase > itemPolicy.effectiveReturnPeriod) {
            canReturn = false;
            policyError = `Return period exceeded (${itemPolicy.effectiveReturnPeriod} days)`;
          }
          
          return {
            ...item,
            refundQty: canReturn ? item.quantity : 0,
            canReturn,
            policyError,
          };
        })
      );
      
      setRefundItems(itemsWithPolicy);
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
        if (item.id === itemId && item.canReturn) {
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
    // Manager authorization required
    setManagerBarcodeModal(true);
  };
  
  const proceedNoReceiptAmount = () => {
    // Manager authorization required for no-receipt refunds
    setManagerBarcodeModal(true);
  };
  
  const verifyManagerBarcode = async () => {
    if (!managerBarcode.trim()) return;
    
    try {
      const res = await fetch("/api/employees/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, barcode: managerBarcode }),
      });
      
      if (!res.ok) {
        setError("Invalid manager barcode");
        setManagerBarcode("");
        return;
      }
      
      const manager = await res.json();
      
      if (!manager.isManager) {
        setError("Manager authorization required");
        setManagerBarcode("");
        return;
      }
      
      setAuthorizedManagerId(manager.id);
      setManagerBarcodeModal(false);
      setManagerBarcode("");
      setError("");
      
      if (mode === "no_receipt") {
        processNoReceiptCredit(manager.id);
      } else {
        setStep("method");
      }
    } catch (err) {
      console.error("Barcode verification error:", err);
      setError("Failed to verify barcode");
    }
  };
  
  const handleManagerBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManagerBarcode(value);
    setError("");
    
    // Auto-submit on EMP- barcode pattern
    if (value.startsWith("EMP-") && value.length >= 9) {
      setTimeout(() => verifyManagerBarcode(), 100);
    }
  };
  
  const handleManagerBarcodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && managerBarcode.trim()) {
      verifyManagerBarcode();
    }
  };
  
  const processNoReceiptCredit = async (managerId: string) => {
    const amount = parseFloat(noReceiptAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const creditRes = await fetch("/api/store-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          amount,
          description: noReceiptDescription || "No receipt return",
          issuedByEmployeeId: employee?.id,
          authorizedByEmployeeId: managerId,
        }),
      });
      
      if (!creditRes.ok) {
        throw new Error("Failed to create store credit");
      }
      
      const credit = await creditRes.json();
      setStoreCreditBarcode(credit.barcode);
      setStep("complete");
    } catch (err) {
      console.error("Store credit error:", err);
      setError("Failed to create store credit");
    } finally {
      setLoading(false);
    }
  };
  
  const processRefund = async () => {
    if (!transaction || !authorizedManagerId) return;
    
    setLoading(true);
    setError("");
    
    try {
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
              itemId: item.itemId,
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
      
      if (refundMethod === "store_credit") {
        const creditRes = await fetch("/api/store-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            amount: refundTotals.total,
            transactionId: refundTxn.id,
            issuedByEmployeeId: employee?.id,
            authorizedByEmployeeId: authorizedManagerId,
          }),
        });
        
        if (creditRes.ok) {
          const credit = await creditRes.json();
          setStoreCreditBarcode(credit.barcode);
        }
      }
      
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
  
  // Mode selection screen
  if (mode === "select") {
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
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full"
        >
          <h2 className="text-2xl font-semibold mb-2">Select Refund Type</h2>
          <p className="text-gray-400 text-center mb-8">
            Does the customer have a receipt?
          </p>
          
          <div className="w-full space-y-4">
            <button
              onClick={() => {
                setMode("receipt");
                setStep("search");
              }}
              className="w-full p-6 rounded-lg border border-gray-700 hover:border-green-500 hover:bg-green-500/10 transition-all flex items-center gap-4"
            >
              <div className="p-3 bg-green-600/20 rounded-lg">
                <Receipt className="h-8 w-8 text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-lg font-medium">With Receipt</p>
                <p className="text-sm text-gray-400">Scan receipt barcode or enter transaction ID</p>
              </div>
            </button>
            
            <button
              onClick={() => {
                setMode("no_receipt");
                setStep("amount");
              }}
              className="w-full p-6 rounded-lg border border-gray-700 hover:border-yellow-500 hover:bg-yellow-500/10 transition-all flex items-center gap-4"
            >
              <div className="p-3 bg-yellow-600/20 rounded-lg">
                <FileQuestion className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="text-left">
                <p className="text-lg font-medium">No Receipt</p>
                <p className="text-sm text-gray-400">Issue store credit only (requires manager scan)</p>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }
  
  // No receipt flow - amount entry
  if (mode === "no_receipt" && step === "amount") {
    return (
      <div className="min-h-screen flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => setMode("select")}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">No Receipt Return</h1>
          <div className="w-24" />
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="text-red-200">{error}</span>
          </div>
        )}
        
        <div className="p-4 mb-6 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-medium">Store Credit Only</p>
              <p className="text-yellow-200/70 text-sm">Without a receipt, only store credit can be issued. Manager barcode scan is required.</p>
            </div>
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full"
        >
          <Gift className="h-16 w-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-6">Enter Store Credit Amount</h2>
          
          <div className="w-full space-y-4">
            <div className="p-4 bg-pos-card border border-pos-border rounded-lg text-center">
              <p className="text-gray-400 text-sm mb-1">Credit Amount</p>
              <p className="text-4xl font-mono font-bold text-yellow-400">
                {formatCurrency(parseFloat(noReceiptAmount) || 0)}
              </p>
            </div>
            
            <Input
              value={noReceiptDescription}
              onChange={(e) => setNoReceiptDescription(e.target.value)}
              placeholder="Reason / Description (optional)"
              className="h-12"
            />
            
            <NumericKeypad
              onKeyPress={(key) => {
                if (key === "." && noReceiptAmount.includes(".")) return;
                setNoReceiptAmount(noReceiptAmount + key);
              }}
              onClear={() => setNoReceiptAmount("")}
              onBackspace={() => setNoReceiptAmount(noReceiptAmount.slice(0, -1))}
              showDecimal
            />
            
            <Button
              variant="pos"
              size="pos-large"
              className="w-full bg-yellow-600 hover:bg-yellow-700"
              onClick={proceedNoReceiptAmount}
              disabled={loading || !noReceiptAmount || parseFloat(noReceiptAmount) <= 0}
            >
              {loading ? <LoadingSpinner size="sm" /> : "Request Manager Approval"}
            </Button>
          </div>
        </motion.div>
        
        {/* Manager Barcode Modal */}
        <Modal
          isOpen={managerBarcodeModal}
          onClose={() => {
            setManagerBarcodeModal(false);
            setManagerBarcode("");
            setError("");
          }}
          title="Manager Authorization Required"
        >
          <div className="text-center">
            <p className="text-gray-400 mb-2">Scan manager barcode to authorize</p>
            <p className="text-yellow-400 font-semibold mb-4">
              No-receipt store credit: {formatCurrency(parseFloat(noReceiptAmount) || 0)}
            </p>
            
            <div className="p-6 bg-gray-900/50 rounded-lg border border-dashed border-gray-700 mb-4">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-green-400 mb-3"
              >
                <ScanLine className="h-12 w-12 mx-auto" />
              </motion.div>
              <Input
                ref={managerBarcodeRef}
                value={managerBarcode}
                onChange={handleManagerBarcodeInput}
                onKeyDown={handleManagerBarcodeKeyDown}
                placeholder="Scan manager barcode"
                className="bg-gray-800 border-gray-600 text-white text-center font-mono"
                autoComplete="off"
              />
            </div>
            
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            
            <Button
              onClick={verifyManagerBarcode}
              disabled={!managerBarcode.trim()}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Authorize
            </Button>
          </div>
        </Modal>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => {
            if (step === "search") {
              setMode("select");
            } else {
              router.push(`/pos/${companyId}/menu`);
            }
          }}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {step === "search" ? "Back" : "Back to Menu"}
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
      
      {policyWarning && (
        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-400" />
          <span className="text-yellow-200">{policyWarning}</span>
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
            Scan the receipt barcode or enter transaction ID
          </p>
          
          <div className="w-full space-y-4">
            <Input
              ref={transactionInputRef}
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Scan receipt or enter ID"
              className="h-14 text-lg"
              onKeyDown={(e) => e.key === "Enter" && searchTransaction()}
              autoFocus
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
                  className={`p-4 bg-pos-card border rounded-lg ${
                    item.canReturn ? "border-pos-border" : "border-red-800/50 bg-red-900/20"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.itemName}</p>
                        {!item.canReturn && (
                          <span className="text-xs bg-red-600/30 text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
                            <Ban className="h-3 w-3" />
                            {item.policyError}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.unitPrice)} × {item.quantity}
                        {item.isWeightItem ? " lb" : ""}
                      </p>
                    </div>
                    
                    {item.canReturn ? (
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
                    ) : (
                      <span className="text-gray-600 text-sm">Not returnable</span>
                    )}
                    
                    <div className="w-24 text-right">
                      <p className={`font-semibold ${item.canReturn ? "text-red-400" : "text-gray-600"}`}>
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
          <h2 className="text-2xl font-bold mb-2">
            {mode === "no_receipt" ? "Store Credit Issued" : "Refund Complete"}
          </h2>
          <p className="text-gray-400 mb-6">
            {mode === "no_receipt" 
              ? `${formatCurrency(parseFloat(noReceiptAmount))} store credit issued`
              : `${formatCurrency(refundTotals.total)} refunded via ${refundMethod === "store_credit" ? "store credit" : refundMethod}`
            }
          </p>
          
          {storeCreditBarcode && (
            <div className="p-6 bg-pos-card border border-pos-border rounded-lg mb-6 text-center">
              <p className="text-sm text-gray-400 mb-2">Store Credit Barcode</p>
              <p className="text-2xl font-mono font-bold text-yellow-400">{storeCreditBarcode}</p>
              <p className="text-sm text-gray-500 mt-2">Print receipt with barcode for customer</p>
              <p className="text-xs text-gray-600 mt-1">Customer can scan this at checkout to redeem</p>
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
      
      {/* Manager Barcode Modal */}
      <Modal
        isOpen={managerBarcodeModal}
        onClose={() => {
          setManagerBarcodeModal(false);
          setManagerBarcode("");
          setError("");
        }}
        title="Manager Authorization Required"
      >
        <div className="text-center">
          <p className="text-gray-400 mb-4">Scan manager barcode to authorize refund</p>
          
          <div className="p-6 bg-gray-900/50 rounded-lg border border-dashed border-gray-700 mb-4">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-green-400 mb-3"
            >
              <ScanLine className="h-12 w-12 mx-auto" />
            </motion.div>
            <Input
              ref={managerBarcodeRef}
              value={managerBarcode}
              onChange={handleManagerBarcodeInput}
              onKeyDown={handleManagerBarcodeKeyDown}
              placeholder="Scan manager barcode"
              className="bg-gray-800 border-gray-600 text-white text-center font-mono"
              autoComplete="off"
            />
          </div>
          
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          
          <Button
            onClick={verifyManagerBarcode}
            disabled={!managerBarcode.trim()}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Authorize
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Receipt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}
