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
  Plus,
  Minus,
  Trash2,
  Scale,
  Package,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CartItem {
  id: string;
  itemId: string;
  barcode: string;
  name: string;
  price: number;
  quantity: number;
  isWeightPriced: boolean;
  taxRate: number;
}

export default function TransactionPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId } = usePOS();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const barcodeBufferRef = useRef<string>("");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Auto-scan detection: scanners type very fast (< 50ms between keys)
  const SCANNER_THRESHOLD_MS = 50;
  const MIN_BARCODE_LENGTH = 4;
  
  // Weight entry modal
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [pendingWeightItem, setPendingWeightItem] = useState<any>(null);
  const [weightInput, setWeightInput] = useState("");
  
  // Transaction info
  const [transactionDate] = useState(new Date());
  const [transactionId] = useState(() => {
    const now = new Date();
    return `TXN-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${now.getTime().toString().slice(-6)}`;
  });
  
  useEffect(() => {
    if (!employee) {
      router.push(`/pos/${companyId}/login`);
    }
  }, [employee, companyId, router]);
  
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);
  
  const lookupItem = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(
        `/api/items/barcode/${encodeURIComponent(barcodeValue)}?companyId=${companyId}`
      );
      
      if (!res.ok) {
        setError("Item not found");
        setBarcode("");
        return;
      }
      
      const item = await res.json();
      
      if (item.isWeightPriced) {
        setPendingWeightItem(item);
        setWeightModalOpen(true);
        setWeightInput("");
      } else {
        addItemToCart(item, 1);
      }
      
      setBarcode("");
    } catch (err) {
      console.error("Lookup error:", err);
      setError("Failed to look up item");
    } finally {
      setLoading(false);
      barcodeInputRef.current?.focus();
    }
  };
  
  const addItemToCart = (item: any, quantity: number) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (ci) => ci.itemId === item.id && !ci.isWeightPriced
      );
      
      if (existingIndex >= 0 && !item.isWeightPriced) {
        const newCart = [...prevCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + quantity,
        };
        return newCart;
      }
      
      return [
        ...prevCart,
        {
          id: `${item.id}-${Date.now()}`,
          itemId: item.id,
          barcode: item.barcode,
          name: item.name,
          price: item.price,
          quantity,
          isWeightPriced: item.isWeightPriced,
          taxRate: item.category?.taxRate ?? 0,
        },
      ];
    });
    
    setError("");
  };
  
  const handleWeightSubmit = () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      return;
    }
    
    if (pendingWeightItem) {
      addItemToCart(pendingWeightItem, weight);
    }
    
    setWeightModalOpen(false);
    setPendingWeightItem(null);
    setWeightInput("");
    barcodeInputRef.current?.focus();
  };
  
  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };
  
  const removeItem = (cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
  };
  
  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    
    (cart ?? []).forEach((item) => {
      const lineTotal = (item?.price ?? 0) * (item?.quantity ?? 0);
      subtotal += lineTotal;
      tax += lineTotal * ((item?.taxRate ?? 0) / 100);
    });
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  };
  
  const totals = calculateTotals();
  
  const handleSubmit = () => {
    if ((cart?.length ?? 0) === 0) {
      setError("Add items to cart first");
      return;
    }
    
    // Store cart data in sessionStorage for payment page
    sessionStorage.setItem(
      "pos_cart",
      JSON.stringify({
        items: cart,
        totals,
        transactionId,
        employeeId: employee?.id,
        shiftId,
      })
    );
    
    router.push(`/pos/${companyId}/payment`);
  };
  
  const handleBarcodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupItem(barcode);
    }
  };
  
  // Handle barcode input change with auto-scan detection
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    
    // If typing is very fast (scanner), accumulate in buffer
    if (timeSinceLastKey < SCANNER_THRESHOLD_MS && newValue.length > barcode.length) {
      barcodeBufferRef.current = newValue;
    } else if (timeSinceLastKey >= SCANNER_THRESHOLD_MS) {
      // Reset buffer on slow typing (human)
      barcodeBufferRef.current = "";
    }
    
    lastKeyTimeRef.current = now;
    setBarcode(newValue);
    
    // Auto-submit after scanner completes (detected by pause after fast input)
    setTimeout(() => {
      const currentTime = Date.now();
      if (currentTime - lastKeyTimeRef.current >= 100 && 
          barcodeBufferRef.current.length >= MIN_BARCODE_LENGTH &&
          barcodeBufferRef.current === newValue) {
        // Scanner finished - auto submit
        lookupItem(newValue);
        barcodeBufferRef.current = "";
      }
    }, 100);
  };
  
  if (!employee) return null;
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          onClick={() => router.push(`/pos/${companyId}/menu`)}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-right">
          <p className="font-mono text-sm text-gray-400">{transactionId}</p>
          <p className="text-xs text-gray-500">
            {transactionDate.toLocaleDateString()} {transactionDate.toLocaleTimeString()}
          </p>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left: Item list */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Barcode input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <Input
              ref={barcodeInputRef}
              value={barcode}
              onChange={handleBarcodeChange}
              onKeyDown={handleBarcodeKeyDown}
              placeholder="Scan barcode (auto-detects) or type and press Enter"
              className="pl-10 h-14 text-lg bg-pos-card border-pos-border text-white"
              autoFocus
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <LoadingSpinner size="sm" />
              </div>
            )}
          </div>
          
          {error && (
            <p className="text-red-400 text-sm mb-4 px-2">{error}</p>
          )}
          
          {/* Cart items */}
          <div className="flex-1 overflow-y-auto space-y-2">
            <AnimatePresence>
              {(cart?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Package className="h-16 w-16 text-gray-700 mb-4" />
                  <p className="text-gray-500">Scan items to begin</p>
                </div>
              ) : (
                cart?.map((item) => (
                  <motion.div
                    key={item?.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-4 bg-pos-card border border-pos-border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{item?.name}</p>
                          {item?.isWeightPriced && (
                            <Scale className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 font-mono">{item?.barcode}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!item?.isWeightPriced && (
                          <>
                            <Button
                              variant="pos"
                              size="icon"
                              onClick={() => updateQuantity(item?.id, -1)}
                              className="h-10 w-10"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-10 text-center font-mono text-lg">
                              {item?.quantity}
                            </span>
                            <Button
                              variant="pos"
                              size="icon"
                              onClick={() => updateQuantity(item?.id, 1)}
                              className="h-10 w-10"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {item?.isWeightPriced && (
                          <span className="font-mono text-yellow-400">
                            {item?.quantity?.toFixed(2)} lb
                          </span>
                        )}
                      </div>
                      
                      <div className="text-right w-24">
                        <p className="font-semibold">
                          {formatCurrency((item?.price ?? 0) * (item?.quantity ?? 0))}
                        </p>
                        <p className="text-xs text-gray-500">
                          @ {formatCurrency(item?.price)}{item?.isWeightPriced ? "/lb" : " ea"}
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item?.id)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Right: Totals panel */}
        <div className="w-64 flex-shrink-0 flex flex-col">
          <div className="flex-1 p-4 bg-pos-card border border-pos-border rounded-lg flex flex-col">
            <h3 className="font-semibold text-gray-400 mb-4">Order Summary</h3>
            
            <div className="flex-1" />
            
            <div className="space-y-3 border-t border-pos-border pt-4">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{formatCurrency(totals?.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Tax</span>
                <span>{formatCurrency(totals?.tax)}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold border-t border-pos-border pt-3">
                <span>TOTAL</span>
                <span className="text-green-400">{formatCurrency(totals?.total)}</span>
              </div>
            </div>
            
            <Button
              variant="pos-success"
              size="pos-large"
              className="w-full mt-4"
              onClick={handleSubmit}
              disabled={(cart?.length ?? 0) === 0}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
      
      {/* Weight entry modal */}
      <Modal
        isOpen={weightModalOpen}
        onClose={() => {
          setWeightModalOpen(false);
          setPendingWeightItem(null);
          setWeightInput("");
          barcodeInputRef.current?.focus();
        }}
        title="Enter Weight"
      >
        <div className="text-center">
          <p className="text-gray-400 mb-4">
            {pendingWeightItem?.name} - {formatCurrency(pendingWeightItem?.price)}/lb
          </p>
          
          <div className="p-4 bg-pos-card border border-pos-border rounded-lg mb-4">
            <p className="text-4xl font-mono">
              {weightInput || "0"} <span className="text-gray-500 text-xl">lb</span>
            </p>
          </div>
          
          <NumericKeypad
            onKeyPress={(key) => {
              if (key === "." && weightInput.includes(".")) return;
              setWeightInput(weightInput + key);
            }}
            onClear={() => setWeightInput("")}
            onBackspace={() => setWeightInput(weightInput.slice(0, -1))}
            onSubmit={handleWeightSubmit}
            submitLabel="Add to Cart"
            showDecimal
          />
        </div>
      </Modal>
    </div>
  );
}