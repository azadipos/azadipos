"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatCurrency } from "@/lib/helpers";
import { Package, AlertTriangle, Truck, TrendingDown, CheckCircle2, Settings2, Save, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";

interface ReorderItem {
  id: string;
  name: string;
  barcode: string;
  currentStock: number;
  reorderLevel: number;
  reorderQty: number;
  soldSinceLastIntake: number;
  cost: number;
  vendor: {
    id: string;
    name: string;
  } | null;
}

interface GroupedItems {
  [vendorId: string]: {
    vendorName: string;
    items: ReorderItem[];
  };
}

interface UnconfiguredItem {
  id: string;
  name: string;
  barcode: string;
  quantityOnHand: number;
  cost: number;
  category: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
}

export default function ReorderPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [orderedItems, setOrderedItems] = useState<Set<string>>(new Set());

  // Bulk reorder point setup
  const [showBulkSetup, setShowBulkSetup] = useState(false);
  const [unconfiguredItems, setUnconfiguredItems] = useState<UnconfiguredItem[]>([]);
  const [unconfiguredStats, setUnconfiguredStats] = useState({ totalItems: 0, configuredCount: 0 });
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkSaved, setBulkSaved] = useState(false);
  const [defaultReorderValue, setDefaultReorderValue] = useState("5");
  
  useEffect(() => {
    fetchReorderItems();
    fetchUnconfiguredItems();
  }, [companyId]);

  const fetchUnconfiguredItems = async () => {
    try {
      const res = await fetch(`/api/items/reorder/bulk?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setUnconfiguredItems(data.unconfigured ?? []);
        setUnconfiguredStats({ totalItems: data.totalItems, configuredCount: data.configuredCount });
        // Initialize bulk values with default
        const vals: Record<string, string> = {};
        (data.unconfigured ?? []).forEach((item: UnconfiguredItem) => {
          vals[item.id] = "5";
        });
        setBulkValues(vals);
      }
    } catch (err) {
      console.error("Failed to fetch unconfigured items:", err);
    }
  };

  const applyDefaultToAll = () => {
    const vals: Record<string, string> = {};
    unconfiguredItems.forEach(item => {
      vals[item.id] = defaultReorderValue;
    });
    setBulkValues(vals);
  };

  const saveBulkReorderPoints = async () => {
    setSavingBulk(true);
    setBulkSaved(false);
    try {
      const updates = Object.entries(bulkValues)
        .filter(([, val]) => parseInt(val) > 0)
        .map(([id, val]) => ({ id, reorderPoint: parseInt(val) }));

      if (updates.length === 0) return;

      const res = await fetch("/api/items/reorder/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, updates }),
      });

      if (res.ok) {
        setBulkSaved(true);
        // Refresh both lists
        await fetchReorderItems();
        await fetchUnconfiguredItems();
        setTimeout(() => setBulkSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save reorder points:", err);
    } finally {
      setSavingBulk(false);
    }
  };
  
  const fetchReorderItems = async () => {
    try {
      const res = await fetch(`/api/items/reorder?companyId=${companyId}`);
      const data = await res.json();
      setItems(data ?? []);
    } catch (err) {
      console.error("Failed to fetch reorder items:", err);
    } finally {
      setLoading(false);
    }
  };
  
  // Filter out ordered items
  const visibleItems = (items ?? []).filter((item) => !orderedItems.has(item.id));
  
  // Group items by vendor
  const groupedItems: GroupedItems = visibleItems.reduce((acc, item) => {
    const vendorId = item?.vendor?.id ?? "no-vendor";
    const vendorName = item?.vendor?.name ?? "No Vendor Assigned";
    
    if (!acc[vendorId]) {
      acc[vendorId] = { vendorName, items: [] };
    }
    acc[vendorId].items.push(item);
    return acc;
  }, {} as GroupedItems);
  
  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };
  
  const selectAllVendor = (vendorId: string) => {
    const vendorItems = groupedItems[vendorId]?.items ?? [];
    setSelectedItems((prev) => {
      const next = new Set(prev);
      vendorItems.forEach((item) => next.add(item.id));
      return next;
    });
  };
  
  const deselectAllVendor = (vendorId: string) => {
    const vendorItems = groupedItems[vendorId]?.items ?? [];
    setSelectedItems((prev) => {
      const next = new Set(prev);
      vendorItems.forEach((item) => next.delete(item.id));
      return next;
    });
  };
  
  const isAllVendorSelected = (vendorId: string) => {
    const vendorItems = groupedItems[vendorId]?.items ?? [];
    return vendorItems.length > 0 && vendorItems.every((item) => selectedItems.has(item.id));
  };
  
  const markAsOrdered = () => {
    // Move selected items to ordered set (removes them from view)
    setOrderedItems((prev) => {
      const next = new Set(prev);
      selectedItems.forEach((id) => next.add(id));
      return next;
    });
    setSelectedItems(new Set());
  };
  
  const undoOrdered = () => {
    // Restore all ordered items back to the list
    setOrderedItems(new Set());
  };
  
  if (loading) {
    return (
      <AdminLayout companyId={companyId}>
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              Reorder List
            </h1>
            <p className="text-gray-400 mt-1">
              Items below reorder level, grouped by supplier
            </p>
          </div>
          <div className="flex items-center gap-3">
            {orderedItems.size > 0 && (
              <Button
                variant="outline"
                onClick={undoOrdered}
                className="border-gray-600"
              >
                Undo Ordered ({orderedItems.size})
              </Button>
            )}
            {selectedItems.size > 0 && (
              <Button
                onClick={markAsOrdered}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Ordered ({selectedItems.size})
              </Button>
            )}
          </div>
        </div>
        
        {/* Info about Order Qty */}
        <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg text-sm text-blue-300">
          <strong>Order Qty</strong> = Suggested quantity to order based on: (reorder level × 2) - current stock.
          This ensures you have buffer stock above the minimum reorder threshold.
        </div>

        {/* Bulk Reorder Point Setup */}
        {unconfiguredItems.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowBulkSetup(!showBulkSetup)}
              className="w-full p-4 flex items-center justify-between hover:bg-amber-900/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-amber-400" />
                <div className="text-left">
                  <p className="font-medium text-amber-300">
                    {unconfiguredItems.length} item{unconfiguredItems.length !== 1 ? "s" : ""} without reorder points
                  </p>
                  <p className="text-sm text-amber-400/70">
                    {unconfiguredStats.configuredCount} of {unconfiguredStats.totalItems} items configured — set reorder points so alerts work
                  </p>
                </div>
              </div>
              {showBulkSetup ? <ChevronUp className="h-5 w-5 text-amber-400" /> : <ChevronDown className="h-5 w-5 text-amber-400" />}
            </button>

            <AnimatePresence>
              {showBulkSetup && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 border-t border-amber-700/30 space-y-4">
                    {/* Apply default to all */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm text-gray-300">Set all to:</span>
                      <Input
                        type="number"
                        value={defaultReorderValue}
                        onChange={(e) => setDefaultReorderValue(e.target.value)}
                        className="w-20 bg-gray-800 border-gray-600 text-white text-center"
                        min="1"
                      />
                      <Button size="sm" variant="outline" onClick={applyDefaultToAll} className="border-gray-600">
                        Apply to All
                      </Button>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        onClick={saveBulkReorderPoints}
                        disabled={savingBulk}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {savingBulk ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4 mr-2" />}
                        {bulkSaved ? "Saved!" : "Save All"}
                      </Button>
                    </div>

                    {/* Item list */}
                    <div className="max-h-96 overflow-y-auto space-y-1">
                      {unconfiguredItems.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-800/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-gray-500">
                              {item.barcode} · Stock: {item.quantityOnHand}
                              {item.category ? ` · ${item.category.name}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Reorder at:</span>
                            <Input
                              type="number"
                              value={bulkValues[item.id] || ""}
                              onChange={(e) => setBulkValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-20 bg-gray-800 border-gray-600 text-white text-center text-sm"
                              min="0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-20 bg-gray-800/50 rounded-lg border border-gray-700">
            <Package className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-300">All stocked up!</h2>
            <p className="text-gray-500 mt-2">
              {orderedItems.size > 0 
                ? `${orderedItems.size} item(s) marked as ordered`
                : "No items have reached their reorder level"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {Object.entries(groupedItems).map(([vendorId, group], groupIndex) => (
              <motion.div
                key={vendorId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: groupIndex * 0.1 }}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-orange-400" />
                    <div>
                      <h3 className="font-semibold text-lg">{group.vendorName}</h3>
                      <p className="text-sm text-gray-500">{group.items.length} item(s) need reorder</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isAllVendorSelected(vendorId)) {
                        deselectAllVendor(vendorId);
                      } else {
                        selectAllVendor(vendorId);
                      }
                    }}
                    className="border-gray-600"
                  >
                    {isAllVendorSelected(vendorId) ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                
                <div className="divide-y divide-gray-700">
                  <AnimatePresence>
                    {group.items.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`p-4 hover:bg-gray-800/50 transition-colors ${
                          selectedItems.has(item.id) ? "bg-blue-900/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItem(item.id)}
                            className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-blue-600"
                          />
                          
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-500 font-mono">{item.barcode}</p>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-6 text-center">
                            <div>
                              <p className="text-xs text-gray-500">Current</p>
                              <p className="font-bold text-red-400">{item.currentStock}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Reorder At</p>
                              <p className="font-medium text-yellow-400">{item.reorderLevel}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Order Qty</p>
                              <p className="font-medium text-green-400">{item.reorderQty}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Unit Cost</p>
                              <p className="font-medium text-blue-400">
                                {item.cost > 0 ? formatCurrency(item.cost) : "N/A"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-400 w-28">
                            <TrendingDown className="h-4 w-4 flex-shrink-0" />
                            <span>{item.soldSinceLastIntake} (30d)</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </AdminLayout>
  );
}
