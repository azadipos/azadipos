"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Gift,
  X,
  User,
  Phone,
  CreditCard,
  Heart,
  Tag,
  Percent,
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
  categoryId?: string;
}

interface Promotion {
  id: string;
  name: string;
  type: string;
  configJson: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

interface PromotionSaving {
  promotionId: string;
  promotionName: string;
  itemId: string;
  itemName: string;
  discount: number;
  description: string;
}

interface AppliedStoreCredit {
  barcode: string;
  amount: number;
}

interface SearchItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  isWeightPriced: boolean;
  category: { id: string; taxRate: number } | null;
}

interface Customer {
  id: string;
  phone: string;
  name: string;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
}

interface AppliedGiftCard {
  barcode: string;
  amount: number;
  giftCardId: string;
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
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Promotions state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  
  // Store credit state
  const [appliedStoreCredits, setAppliedStoreCredits] = useState<AppliedStoreCredit[]>([]);
  
  // Gift card state
  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
  
  // Customer state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  
  // Search dropdown for manual typing
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Constants for detection
  const SCANNER_THRESHOLD_MS = 50;  // Scanners type < 50ms between keys
  const MIN_BARCODE_LENGTH = 4;
  const SEARCH_DELAY_MS = 150;  // Reduced for faster response
  const AUTO_SUBMIT_DELAY_MS = 100;  // Short delay after scanner stops
  
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
  
  // Fetch active promotions
  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        const res = await fetch(`/api/promotions?companyId=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          // Filter only active promotions within date range
          const now = new Date();
          const activePromos = data.filter((p: Promotion) => {
            if (!p.isActive) return false;
            if (p.startDate && new Date(p.startDate) > now) return false;
            if (p.endDate && new Date(p.endDate) < now) return false;
            return true;
          });
          setPromotions(activePromos);
        }
      } catch (err) {
        console.error("Failed to fetch promotions:", err);
      }
    };
    
    if (companyId) {
      fetchPromotions();
    }
  }, [companyId]);
  
  // Always keep focus on barcode input (pause when modals are open)
  useEffect(() => {
    const focusInput = () => {
      // Don't refocus if any modal is open
      if (!weightModalOpen && !customerModalOpen && barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    };
    
    focusInput();
    
    // Refocus after any interaction, but only if modals are closed
    const handleClick = () => {
      if (!weightModalOpen && !customerModalOpen) {
        setTimeout(focusInput, 100);
      }
    };
    document.addEventListener("click", handleClick);
    
    return () => document.removeEventListener("click", handleClick);
  }, [weightModalOpen, customerModalOpen]);
  
  // Search items - optimized with debounce
  const searchItems = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/items/search?companyId=${companyId}&q=${encodeURIComponent(query)}&limit=15`
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
      // Check if this is a store credit barcode (starts with SC-)
      if (barcodeValue.toUpperCase().startsWith("SC-")) {
        await lookupStoreCredit(barcodeValue);
        setBarcode("");
        return;
      }
      
      // Check if this is a gift card barcode (starts with GC-)
      if (barcodeValue.toUpperCase().startsWith("GC-")) {
        await lookupGiftCard(barcodeValue);
        setBarcode("");
        return;
      }
      
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
  
  const lookupGiftCard = async (gcBarcode: string) => {
    try {
      const res = await fetch(`/api/gift-cards?barcode=${encodeURIComponent(gcBarcode)}`);
      
      if (!res.ok) {
        setError("Gift card not found");
        return;
      }
      
      const giftCard = await res.json();
      
      // Check company match
      if (giftCard.companyId !== companyId) {
        setError("This gift card is for a different store");
        return;
      }
      
      // If not yet purchased (first scan) - add as an item to sell
      if (!giftCard.purchasedAt) {
        // Add gift card as a cart item
        const gcItem: CartItem = {
          id: `gc-${giftCard.id}`,
          itemId: giftCard.id,
          barcode: giftCard.barcode,
          name: `Gift Card (${formatCurrency(giftCard.initialValue)})`,
          price: giftCard.initialValue,
          quantity: 1,
          isWeightPriced: false,
          taxRate: 0, // Gift cards are typically not taxed
        };
        setCart(prev => [...prev, gcItem]);
        setError("");
        return;
      }
      
      // If already purchased - check if we can apply balance
      if (giftCard.balance <= 0) {
        setError("This gift card has no remaining balance");
        return;
      }
      
      // Check if already applied
      if (appliedGiftCards.some(gc => gc.barcode.toUpperCase() === gcBarcode.toUpperCase())) {
        setError("Gift card already applied to this transaction");
        return;
      }
      
      // Apply gift card balance
      setAppliedGiftCards(prev => [...prev, {
        barcode: giftCard.barcode,
        amount: giftCard.balance,
        giftCardId: giftCard.id,
      }]);
      setError("");
    } catch (err) {
      console.error("Gift card lookup error:", err);
      setError("Failed to lookup gift card");
    }
  };
  
  const removeGiftCard = (gcBarcode: string) => {
    setAppliedGiftCards(prev => prev.filter(gc => gc.barcode !== gcBarcode));
  };
  
  const lookupCustomer = async () => {
    if (!customerPhone.trim()) return;
    
    setCustomerLoading(true);
    try {
      const res = await fetch(`/api/customers?companyId=${companyId}&phone=${encodeURIComponent(customerPhone)}`);
      
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
        setCustomerModalOpen(false);
        setCustomerPhone("");
        setCustomerName("");
      } else {
        // Customer not found - offer to create
        setCustomer(null);
      }
    } catch (err) {
      console.error("Customer lookup error:", err);
    } finally {
      setCustomerLoading(false);
    }
  };
  
  const createCustomer = async () => {
    if (!customerPhone.trim() || !customerName.trim()) return;
    
    setCustomerLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          phone: customerPhone,
          name: customerName,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
        setCustomerModalOpen(false);
        setCustomerPhone("");
        setCustomerName("");
      }
    } catch (err) {
      console.error("Create customer error:", err);
    } finally {
      setCustomerLoading(false);
    }
  };
  
  const lookupStoreCredit = async (creditBarcode: string) => {
    try {
      // Check if already applied
      if (appliedStoreCredits.some(sc => sc.barcode.toUpperCase() === creditBarcode.toUpperCase())) {
        setError("Store credit already applied to this transaction");
        return;
      }
      
      const res = await fetch(`/api/store-credits?barcode=${encodeURIComponent(creditBarcode)}`);
      
      if (!res.ok) {
        const data = await res.json();
        if (data.error === "Store credit already used") {
          setError("This store credit has already been redeemed");
        } else {
          setError("Store credit not found");
        }
        return;
      }
      
      const credit = await res.json();
      
      // Check company match
      if (credit.companyId !== companyId) {
        setError("This store credit is for a different store");
        return;
      }
      
      // Add to applied store credits
      setAppliedStoreCredits(prev => [...prev, {
        barcode: credit.barcode,
        amount: credit.amount,
      }]);
      
      setError("");
    } catch (err) {
      console.error("Store credit lookup error:", err);
      setError("Failed to lookup store credit");
    }
  };
  
  const removeStoreCredit = (creditBarcode: string) => {
    setAppliedStoreCredits(prev => prev.filter(sc => sc.barcode !== creditBarcode));
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
          categoryId: item.category?.id,
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
  
  // Calculate promotion savings
  const promotionSavings = useMemo(() => {
    const savings: PromotionSaving[] = [];
    if (!cart || cart.length === 0 || !promotions || promotions.length === 0) return savings;
    
    for (const promo of promotions) {
      if (!promo.configJson) continue;
      
      try {
        const config = JSON.parse(promo.configJson);
        
        if (promo.type === "bogo") {
          // BOGO: Buy X, Get Y at Z% off
          const triggerQty = config.triggerQty || 1;
          const freeQty = config.freeQty || 1;
          const percentOff = config.percentOff ?? 100;
          const appliesTo = config.appliesTo || "item";
          
          // Find matching items
          const matchingItems = cart.filter(item => {
            if (appliesTo === "item" && config.itemId) {
              return item.itemId === config.itemId;
            }
            if (appliesTo === "category" && config.categoryId) {
              return item.categoryId === config.categoryId;
            }
            if (appliesTo === "all") return true;
            return false;
          });
          
          for (const item of matchingItems) {
            if (item.isWeightPriced) continue; // Skip weight-priced items for BOGO
            
            const totalQty = Math.floor(item.quantity);
            const setSize = triggerQty + freeQty;
            const completeSets = Math.floor(totalQty / setSize);
            
            if (completeSets > 0) {
              const freeItemsCount = completeSets * freeQty;
              const discount = freeItemsCount * item.price * (percentOff / 100);
              
              if (discount > 0) {
                savings.push({
                  promotionId: promo.id,
                  promotionName: promo.name,
                  itemId: item.itemId,
                  itemName: item.name,
                  discount: Math.round(discount * 100) / 100,
                  description: percentOff === 100 
                    ? `Buy ${triggerQty} Get ${freeQty} Free` 
                    : `Buy ${triggerQty} Get ${freeQty} at ${percentOff}% Off`,
                });
              }
            }
          }
        }
        
        if (promo.type === "sale") {
          // Sale: % or $ off selected items
          const discountType = config.discountType || "percent";
          const discountValue = config.discountValue || 0;
          const appliesTo = config.appliesTo || "items";
          const itemIds = config.itemIds || [];
          
          const matchingItems = cart.filter(item => {
            if (appliesTo === "items" && itemIds.length > 0) {
              return itemIds.includes(item.itemId);
            }
            if (appliesTo === "category" && config.categoryId) {
              return item.categoryId === config.categoryId;
            }
            if (appliesTo === "all") return true;
            return false;
          });
          
          for (const item of matchingItems) {
            const lineTotal = item.price * item.quantity;
            let discount = 0;
            
            if (discountType === "percent") {
              discount = lineTotal * (discountValue / 100);
            } else {
              // Dollar off per item
              discount = Math.min(discountValue * item.quantity, lineTotal);
            }
            
            if (discount > 0) {
              savings.push({
                promotionId: promo.id,
                promotionName: promo.name,
                itemId: item.itemId,
                itemName: item.name,
                discount: Math.round(discount * 100) / 100,
                description: discountType === "percent" 
                  ? `${discountValue}% Off` 
                  : `$${discountValue} Off`,
              });
            }
          }
        }
        
        if (promo.type === "bundle") {
          // Bundle: Buy X for $Y
          const bundleQty = config.qty || 2;
          const bundlePrice = config.price || 0;
          const appliesTo = config.appliesTo || "item";
          
          const matchingItems = cart.filter(item => {
            if (appliesTo === "item" && config.itemId) {
              return item.itemId === config.itemId;
            }
            if (appliesTo === "category" && config.categoryId) {
              return item.categoryId === config.categoryId;
            }
            return false;
          });
          
          for (const item of matchingItems) {
            if (item.isWeightPriced) continue;
            
            const totalQty = Math.floor(item.quantity);
            const completeBundles = Math.floor(totalQty / bundleQty);
            
            if (completeBundles > 0) {
              const regularPrice = completeBundles * bundleQty * item.price;
              const bundledPrice = completeBundles * bundlePrice;
              const discount = regularPrice - bundledPrice;
              
              if (discount > 0) {
                savings.push({
                  promotionId: promo.id,
                  promotionName: promo.name,
                  itemId: item.itemId,
                  itemName: item.name,
                  discount: Math.round(discount * 100) / 100,
                  description: `Buy ${bundleQty} for ${formatCurrency(bundlePrice)}`,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error parsing promotion config:", err);
      }
    }
    
    return savings;
  }, [cart, promotions]);
  
  const totalPromotionSavings = useMemo(() => {
    return promotionSavings.reduce((sum, s) => sum + s.discount, 0);
  }, [promotionSavings]);
  
  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    
    (cart ?? []).forEach((item) => {
      const lineTotal = (item?.price ?? 0) * (item?.quantity ?? 0);
      subtotal += lineTotal;
      tax += lineTotal * ((item?.taxRate ?? 0) / 100);
    });
    
    // Apply promotion savings before tax calculation (for accurate tax)
    const discountedSubtotal = subtotal - totalPromotionSavings;
    const discountedTax = tax - (totalPromotionSavings * (tax / subtotal || 0));
    
    const storeCreditTotal = appliedStoreCredits.reduce((sum, sc) => sum + sc.amount, 0);
    const giftCardTotal = appliedGiftCards.reduce((sum, gc) => sum + gc.amount, 0);
    const grossTotal = Math.max(0, discountedSubtotal) + Math.max(0, discountedTax);
    const creditsTotal = storeCreditTotal + giftCardTotal;
    const total = Math.max(0, grossTotal - creditsTotal);
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountedSubtotal: Math.round(Math.max(0, discountedSubtotal) * 100) / 100,
      tax: Math.round(Math.max(0, discountedTax) * 100) / 100,
      promotionSavings: Math.round(totalPromotionSavings * 100) / 100,
      storeCreditTotal: Math.round(storeCreditTotal * 100) / 100,
      giftCardTotal: Math.round(giftCardTotal * 100) / 100,
      grossTotal: Math.round(grossTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
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
        appliedStoreCredits,
        appliedGiftCards,
        promotionSavings,
        customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, loyaltyPoints: customer.loyaltyPoints } : null,
      })
    );
    
    router.push(`/pos/${companyId}/payment`);
  };
  
  // Handle paste event - treat as scanner input
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").trim();
    
    if (pastedText.length >= MIN_BARCODE_LENGTH) {
      // Pasted text is treated like scanner input - auto lookup
      setBarcode(pastedText);
      setShowSearch(false);
      
      // Clear any pending timeouts
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Auto-submit after short delay
      autoSubmitTimeoutRef.current = setTimeout(() => {
        lookupItem(pastedText);
      }, 50);
    }
  };
  
  // Handle barcode input with scanner detection
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    
    // Detect scanner mode: very fast typing (< 50ms between keys)
    if (timeSinceLastKey < SCANNER_THRESHOLD_MS && newValue.length > barcode.length) {
      scannerModeRef.current = true;
    } else if (timeSinceLastKey >= SCANNER_THRESHOLD_MS * 3) {
      // Reset scanner mode on slow typing
      scannerModeRef.current = false;
    }
    
    lastKeyTimeRef.current = now;
    setBarcode(newValue);
    setError("");
    
    // Clear existing timeouts
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (scannerModeRef.current) {
      // Scanner mode: auto-submit after pause
      autoSubmitTimeoutRef.current = setTimeout(() => {
        if (newValue.length >= MIN_BARCODE_LENGTH) {
          lookupItem(newValue);
          scannerModeRef.current = false;
        }
      }, AUTO_SUBMIT_DELAY_MS);
    } else {
      // Manual typing mode: show search dropdown after short delay
      searchTimeoutRef.current = setTimeout(() => {
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
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
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
        
        {/* Customer Button */}
        <button
          onClick={() => setCustomerModalOpen(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            customer 
              ? 'bg-green-900/30 border-green-600/50 text-green-400' 
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <User className="h-4 w-4" />
          {customer ? (
            <span>{customer.name} • {customer.loyaltyPoints} pts</span>
          ) : (
            <span>Add Customer</span>
          )}
        </button>
        
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
              onPaste={handlePaste}
              onFocus={() => barcode.length >= 1 && searchResults.length > 0 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Scan barcode or type to search..."
              className="pl-10 h-14 text-lg bg-pos-card border-pos-border text-white"
              autoFocus
              autoComplete="off"
            />
            {(loading || searchLoading) && (
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
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur before click
                        selectSearchItem(item);
                      }}
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
                  <p className="text-xs text-gray-600 mt-2">Scanner auto-detects • Paste barcode • Type to search</p>
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
        <div className="w-80 flex flex-col">
          <div className="bg-pos-card border border-pos-border rounded-lg p-4 flex-1 flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span>{formatCurrency(totals?.subtotal ?? 0)}</span>
                </div>
                
                {/* Promotion Savings - Show prominently */}
                {promotionSavings.length > 0 && (
                  <div className="border-t border-green-800 pt-2 mt-2 bg-green-900/20 -mx-4 px-4 py-2">
                    <div className="flex items-center gap-1 mb-2">
                      <Tag className="h-4 w-4 text-green-400" />
                      <span className="text-green-400 font-semibold text-xs uppercase tracking-wide">
                        Savings Applied!
                      </span>
                    </div>
                    {promotionSavings.map((saving, idx) => (
                      <div key={`${saving.promotionId}-${saving.itemId}-${idx}`} className="flex justify-between items-start text-xs mb-1">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-green-300 truncate">{saving.promotionName}</p>
                          <p className="text-green-500/70 truncate text-[10px]">{saving.itemName} • {saving.description}</p>
                        </div>
                        <span className="text-green-400 font-medium whitespace-nowrap">
                          -{formatCurrency(saving.discount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-green-800">
                      <span className="text-green-400 font-semibold flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        Total Savings
                      </span>
                      <span className="text-green-400 font-bold">
                        -{formatCurrency(totals?.promotionSavings ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Tax</span>
                  <span>{formatCurrency(totals?.tax ?? 0)}</span>
                </div>
                
                {/* Applied Store Credits */}
                {appliedStoreCredits.length > 0 && (
                  <div className="border-t border-pos-border pt-2 mt-2">
                    <p className="text-xs text-yellow-400 flex items-center gap-1 mb-2">
                      <Gift className="h-3 w-3" />
                      Store Credits Applied
                    </p>
                    {appliedStoreCredits.map((sc) => (
                      <div key={sc.barcode} className="flex justify-between items-center group">
                        <span className="text-yellow-400 text-xs font-mono">{sc.barcode}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400">-{formatCurrency(sc.amount)}</span>
                          <button
                            onClick={() => removeStoreCredit(sc.barcode)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Applied Gift Cards */}
                {appliedGiftCards.length > 0 && (
                  <div className="border-t border-pos-border pt-2 mt-2">
                    <p className="text-xs text-indigo-400 flex items-center gap-1 mb-2">
                      <CreditCard className="h-3 w-3" />
                      Gift Cards Applied
                    </p>
                    {appliedGiftCards.map((gc) => (
                      <div key={gc.barcode} className="flex justify-between items-center group">
                        <span className="text-indigo-400 text-xs font-mono">{gc.barcode}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-indigo-400">-{formatCurrency(gc.amount)}</span>
                          <button
                            onClick={() => removeGiftCard(gc.barcode)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="border-t border-pos-border pt-4 mt-4">
              {(appliedStoreCredits.length > 0 || appliedGiftCards.length > 0) && (
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Before Credits</span>
                  <span>{formatCurrency(totals?.grossTotal ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span className="text-green-400">{formatCurrency(totals?.total ?? 0)}</span>
              </div>
              
              {/* Show total savings prominently at bottom */}
              {(totals?.promotionSavings ?? 0) > 0 && (
                <div className="mt-2 text-center py-2 bg-green-900/30 rounded-lg border border-green-700">
                  <p className="text-green-400 font-semibold text-sm">
                    🎉 You saved {formatCurrency(totals?.promotionSavings ?? 0)} today!
                  </p>
                </div>
              )}
              
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
          setWeightInput("");
          barcodeInputRef.current?.focus();
        }}
        title="Enter Weight"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-lg font-medium">{pendingWeightItem?.name}</p>
            <p className="text-green-400">
              {formatCurrency(pendingWeightItem?.price ?? 0)}/lb
            </p>
          </div>
          
          <div className="text-center py-4">
            <span className="text-4xl font-mono">
              {weightInput || "0.00"}
            </span>
            <span className="text-xl text-gray-400 ml-2">lb</span>
          </div>
          
          <NumericKeypad
            onKeyPress={(key) => setWeightInput((prev) => prev + key)}
            onClear={() => setWeightInput("")}
            onBackspace={() => setWeightInput((prev) => prev.slice(0, -1))}
            showDecimal
          />
          
          <Button
            className="w-full h-14 text-lg"
            onClick={handleWeightSubmit}
            disabled={!weightInput || parseFloat(weightInput) <= 0}
          >
            Add to Cart
          </Button>
        </div>
      </Modal>
      
      {/* Customer lookup modal */}
      <Modal
        isOpen={customerModalOpen}
        onClose={() => {
          setCustomerModalOpen(false);
          setCustomerPhone("");
          setCustomerName("");
        }}
        title="Customer Lookup"
      >
        <div className="space-y-4">
          {customer ? (
            // Customer found - show info
            <div className="space-y-4">
              <div className="p-4 bg-green-900/30 border border-green-600/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-600/20 rounded-full">
                    <User className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{customer.name}</p>
                    <p className="text-sm text-gray-400">{customer.phone}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center pt-3 border-t border-green-700/50">
                  <div>
                    <p className="text-2xl font-bold text-green-400">{customer.loyaltyPoints}</p>
                    <p className="text-xs text-gray-400">Points</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{formatCurrency(customer.totalSpent)}</p>
                    <p className="text-xs text-gray-400">Total Spent</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{customer.visitCount}</p>
                    <p className="text-xs text-gray-400">Visits</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCustomer(null)}
                  className="flex-1 border-gray-600"
                >
                  Remove Customer
                </Button>
                <Button
                  onClick={() => setCustomerModalOpen(false)}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            // Customer lookup form
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && lookupCustomer()}
                      placeholder="(555) 123-4567"
                      className="pl-10 bg-gray-800 border-gray-600"
                    />
                  </div>
                  <Button onClick={lookupCustomer} disabled={customerLoading || !customerPhone.trim()}>
                    {customerLoading ? <LoadingSpinner size="sm" /> : "Find"}
                  </Button>
                </div>
              </div>
              
              {customerPhone && !customerLoading && (
                <div className="border-t border-gray-700 pt-4">
                  <p className="text-sm text-gray-400 mb-3">Customer not found? Create a new one:</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Name</label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="John Smith"
                        className="bg-gray-800 border-gray-600"
                      />
                    </div>
                    <Button
                      onClick={createCustomer}
                      disabled={!customerName.trim() || customerLoading}
                      className="w-full"
                    >
                      Create Customer
                    </Button>
                  </div>
                </div>
              )}
              
              <Button
                variant="ghost"
                onClick={() => {
                  setCustomerModalOpen(false);
                  setCustomerPhone("");
                  setCustomerName("");
                }}
                className="w-full text-gray-400"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
