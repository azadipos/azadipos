"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface SearchItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  isWeightPriced: boolean;
  category: { taxRate: number } | null;
}

export default function TransactionPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, shiftId } = usePOS();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const scannerModeRef = useRef<boolean>(false);
  const autoSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Search dropdown for manual typing
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Auto-scan detection: scanners type very fast (< 50ms between keys)
  const SCANNER_THRESHOLD_MS = 50;
  const MIN_BARCODE_LENGTH = 4;
  const SEARCH_DELAY_MS = 300;
  
  // Weight entry modal
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [pendingWeightItem, setPendingWeightItem] = useState<SearchItem | null>(null);
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
  
  // Always keep focus on barcode input
  useEffect(() => {
    const focusInput = () => {
      if (!weightModalOpen && barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };
    
    focusInput();
    
    // Refocus after any interaction
    const handleClick = () => setTimeout(focusInput, 100);
    document.addEventListener("click", handleClick);
    
    return () => document.removeEventListener("click", handleClick);
  }, [weightModalOpen]);
  
  // Search items for manual typing
  const searchItems = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/items/search?companyId=${companyId}&q=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data ?? []);
        setShowSearch(true);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearchLoading(false);
    }
  }, [companyId]);
  
  const lookupItem = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;
    
    setLoading(true);
    setError("");
    setShowSearch(false);
    
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
  
  const addItemToCart = (item: SearchItem, quantity: number) => {
    setCart((prevCart) => {
      // For non-weight items, check if already in cart
      if (!item.isWeightPriced) {
        const existingIndex = prevCart.findIndex(
          (ci) => ci.itemId === item.id && !ci.isWeightPriced
        );
        
        if (existingIndex >= 0) {
          // Increase quantity of existing item
          const newCart = [...prevCart];
          newCart[existingIndex] = {
            ...newCart[existingIndex],
            quantity: newCart[existingIndex].quantity + quantity,
          };
          return newCart;
        }
      }
      
      // Add new item
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
    setShowSearch(false);
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
  
  // Handle barcode input with scanner detection
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    
    // Detect scanner mode: very fast typing
    if (timeSinceLastKey < SCANNER_THRESHOLD_MS && newValue.length > barcode.length) {
      scannerModeRef.current = true;
    } else if (timeSinceLastKey >= SCANNER_THRESHOLD_MS * 3) {
      // Reset scanner mode on slow typing
      scannerModeRef.current = false;
    }
    
    lastKeyTimeRef.current = now;
    setBarcode(newValue);
    setError("");
    
    // Clear existing timeout
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }
    
    if (scannerModeRef.current) {
      // Scanner mode: auto-submit after pause
      autoSubmitTimeoutRef.current = setTimeout(() => {
        if (newValue.length >= MIN_BARCODE_LENGTH) {
          lookupItem(newValue);
          scannerModeRef.current = false;
        }
      }, 100);
    } else {
      // Manual typing mode: show search dropdown
      autoSubmitTimeoutRef.current = setTimeout(() => {
        searchItems(newValue);
      }, SEARCH_DELAY_MS);
    }
  };
  
  const handleBarcodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
      setShowSearch(false);
      lookupItem(barcode);
    } else if (e.key === "Escape") {
      setShowSearch(false);
      setSearchResults([]);
    } else if (e.key === "ArrowDown" && searchResults.length > 0) {
      e.preventDefault();
      // Could implement keyboard navigation here
    }
  };
  
  const selectSearchItem = (item: SearchItem) => {
    if (item.isWeightPriced) {
      setPendingWeightItem(item);
      setWeightModalOpen(true);
      setWeightInput("");
    } else {
      addItemToCart(item, 1);
    }
    setBarcode("");
    setShowSearch(false);
    barcodeInputRef.current?.focus();
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
          {/* Barcode input with search dropdown */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 z-10" />
            <Input
              ref={barcodeInputRef}
              value={barcode}
              onChange={handleBarcodeChange}
              onKeyDown={handleBarcodeKeyDown}
              onFocus={() => barcode.length >= 2 && searchResults.length > 0 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Scan barcode or type to search..."
              className="pl-10 h-14 text-lg bg-pos-card border-pos-border text-white"
              autoFocus
              autoComplete="off"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <LoadingSpinner size="sm" />
              </div>
            )}
            
            {/* Search dropdown */}
            <AnimatePresence>
              {showSearch && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-20 left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
                >
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectSearchItem(item)}
                      className="w-full p-3 text-left hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-gray-500 font-mono">{item.barcode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isWeightPriced && (
                          <Scale className="h-4 w-4 text-yellow-400" />
                        )}
                        <span className="font-bold text-green-400">
                          {formatCurrency(item.price)}
                          {item.isWeightPriced && "/lb"}
                        </span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
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
                  <p className="text-xs text-gray-600 mt-2">Scanner auto-detects • Type to search</p>
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
                          <span className="w-24 text-center font-mono">
                            {item?.quantity?.toFixed(2)} lb
                          </span>
                        )}
                      </div>
                      
                      <div className="w-24 text-right">
                        <p className="font-bold text-green-400">
                          {formatCurrency((item?.price ?? 0) * (item?.quantity ?? 0))}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item?.price ?? 0)}
                          {item?.isWeightPriced ? "/lb" : " ea"}
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item?.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Right: Totals */}
        <div className="w-72 flex flex-col">
          <div className="bg-pos-card border border-pos-border rounded-lg p-4 flex-1 flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            
            <div className="flex-1">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span>{formatCurrency(totals?.subtotal ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tax</span>
                  <span>{formatCurrency(totals?.tax ?? 0)}</span>
                </div>
              </div>
            </div>
            
            <div className="border-t border-pos-border pt-4 mt-4">
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span className="text-green-400">{formatCurrency(totals?.total ?? 0)}</span>
              </div>
              
              <Button
                variant="pos-primary"
                className="w-full mt-4 h-14 text-lg"
                onClick={handleSubmit}
                disabled={(cart?.length ?? 0) === 0}
              >
                Pay
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Weight entry modal */}
      <Modal
        isOpen={weightModalOpen}
        onClose={() => {
          setWeightModalOpen(false);
          setPendingWeightItem(null);
          barcodeInputRef.current?.focus();
        }}
        title="Enter Weight"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-lg font-medium">{pendingWeightItem?.name}</p>
            <p className="text-gray-400">{formatCurrency(pendingWeightItem?.price ?? 0)} / lb</p>
          </div>
          
          <div className="p-4 bg-pos-card rounded-lg text-center">
            <p className="text-4xl font-mono font-bold">
              {weightInput || "0.00"}
              <span className="text-lg text-gray-400 ml-2">lb</span>
            </p>
          </div>
          
          <NumericKeypad
            showDecimal
            onKeyPress={(key) => {
              if (key === "." && weightInput.includes(".")) return;
              if (weightInput.split(".")[1]?.length >= 2) return;
              setWeightInput(weightInput + key);
            }}
            onClear={() => setWeightInput("")}
            onBackspace={() => setWeightInput(weightInput.slice(0, -1))}
            onSubmit={handleWeightSubmit}
            submitLabel="Add to Cart"
          />
        </div>
      </Modal>
    </div>
  );
}
