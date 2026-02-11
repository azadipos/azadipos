"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatCurrency } from "@/lib/helpers";
import { Package, AlertTriangle, Truck, TrendingDown, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function ReorderPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const [items, setItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [orderedItems, setOrderedItems] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    fetchReorderItems();
  }, [companyId]);
  
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
  const groupedItems: GroupedItems = visibleItems.reduce((acc: any, item: any) => {
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
