"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SearchableItemSelect } from "@/components/searchable-item-select";
import { ClipboardList, Plus, Trash2, Calendar, Building2, Package, X, AlertTriangle, DollarSign, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/helpers";

interface ReceivingLog {
  id: string;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  itemsJson: string | null;
  invoiceImageUrl: string | null;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  barcode: string;
  cost: number;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
}

interface ReceiveItem {
  itemId: string;
  itemName: string;
  quantity: number;
  cost?: number;
  currentCost?: number;
  currentVendorName?: string;
  updateCost?: boolean; // Whether to update this item's cost in inventory
  updateVendor?: boolean; // Whether to update this item's vendor in inventory
}

export default function ReceivingPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [logs, setLogs] = useState<ReceivingLog[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<ReceivingLog | null>(null);
  
  // Form state
  const [vendorId, setVendorId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [currentItemId, setCurrentItemId] = useState("");
  const [currentQty, setCurrentQty] = useState("");
  const [currentCost, setCurrentCost] = useState("");
  const [updateItemCosts, setUpdateItemCosts] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, [companyId]);
  
  const fetchData = async () => {
    try {
      const [logsRes, vendorsRes, itemsRes] = await Promise.all([
        fetch(`/api/receiving?companyId=${companyId}`),
        fetch(`/api/companies/${companyId}/vendors`),
        fetch(`/api/items?companyId=${companyId}`),
      ]);
      const [logsData, vendorsData, itemsData] = await Promise.all([
        logsRes.json(),
        vendorsRes.json(),
        itemsRes.json(),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
      setAllItems(Array.isArray(itemsData) ? itemsData : []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const addItem = () => {
    if (!currentItemId || !currentQty) return;
    const item = allItems.find(i => i.id === currentItemId);
    if (!item) return;
    
    const newCost = currentCost ? parseFloat(currentCost) : undefined;
    const selectedVendor = vendors.find(v => v.id === vendorId);
    
    // Check if cost or vendor is different
    const hasCostDifference = newCost !== undefined && item.cost > 0 && Math.abs(newCost - item.cost) > 0.001;
    const hasVendorDifference = vendorId && item.vendorId && vendorId !== item.vendorId;
    
    const newItem: ReceiveItem = {
      itemId: currentItemId,
      itemName: item.name,
      quantity: parseFloat(currentQty),
      cost: newCost,
      currentCost: item.cost,
      currentVendorName: item.vendor?.name || undefined,
      // Default to updating cost if there's a difference (admin can override)
      updateCost: hasCostDifference,
      updateVendor: hasVendorDifference || false,
    };
    
    setReceiveItems([...receiveItems, newItem]);
    setCurrentItemId("");
    setCurrentQty("");
    setCurrentCost("");
  };
  
  // Toggle whether to update a specific item's cost
  const toggleUpdateCost = (idx: number) => {
    setReceiveItems(prev => prev.map((item, i) => 
      i === idx ? { ...item, updateCost: !item.updateCost } : item
    ));
  };
  
  // Toggle whether to update a specific item's vendor
  const toggleUpdateVendor = (idx: number) => {
    setReceiveItems(prev => prev.map((item, i) => 
      i === idx ? { ...item, updateVendor: !item.updateVendor } : item
    ));
  };
  
  const removeItem = (idx: number) => {
    setReceiveItems(receiveItems.filter((_, i) => i !== idx));
  };
  
  const handleCreate = async () => {
    if (receiveItems.length === 0) return;
    setSaving(true);
    try {
      // Prepare items with individual update decisions
      const itemsForApi = receiveItems.map(item => ({
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: item.quantity,
        cost: item.cost,
        updateCost: item.updateCost || false,
        updateVendor: item.updateVendor || false,
      }));
      
      await fetch("/api/receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          vendorId: vendorId || null,
          items: itemsForApi,
          notes,
        }),
      });
      setModalOpen(false);
      setVendorId("");
      setNotes("");
      setReceiveItems([]);
      setCurrentCost("");
      fetchData();
    } catch (err) {
      console.error("Failed to create receiving log:", err);
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this receiving record? Note: Inventory quantities will NOT be reverted.")) return;
    try {
      await fetch(`/api/receiving/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };
  
  const parseItemsJson = (json: string | null): ReceiveItem[] => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  };
  
  if (loading) {
    return (
      <AdminLayout companyId={companyId}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Receiving</h1>
            <p className="text-gray-400">Log incoming inventory shipments</p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Shipment
          </Button>
        </div>
        
        {/* Summary */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-600/20 rounded-lg">
              <Package className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Shipments</p>
              <p className="text-2xl font-bold">{logs.length}</p>
            </div>
          </div>
        </div>
        
        {/* Receiving Logs List */}
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
              <ClipboardList className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No shipments logged yet</p>
              <p className="text-sm text-gray-500">Click "Log Shipment" to add one</p>
            </div>
          ) : (
            logs.map((log, idx) => {
              const items = parseItemsJson(log.itemsJson);
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gray-800/50 rounded-lg border border-gray-700 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-700 rounded-lg">
                      <Package className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {log.vendor ? (
                          <span className="font-medium flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {log.vendor.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">No vendor specified</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                        <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailLog(log)}
                    >
                      View Items
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(log.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log Shipment"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Vendor (Optional)</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
            >
              <option value="">No specific vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          
          {/* Add Items */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Add Items</label>
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <SearchableItemSelect
                  items={allItems}
                  selectedId={currentItemId}
                  onSelect={setCurrentItemId}
                  placeholder="Search item..."
                />
              </div>
              <Input
                type="number"
                value={currentQty}
                onChange={(e) => setCurrentQty(e.target.value)}
                placeholder="Qty"
                className="w-20"
              />
              <Input
                type="number"
                step="0.01"
                value={currentCost}
                onChange={(e) => setCurrentCost(e.target.value)}
                placeholder="Cost $"
                className="w-24"
              />
              <Button onClick={addItem} disabled={!currentItemId || !currentQty}>
                Add
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Cost is per unit (optional)</p>
          </div>
          
          {/* Items List */}
          {receiveItems.length > 0 && (
            <div className="border border-gray-700 rounded-lg divide-y divide-gray-700">
              {receiveItems.map((item, idx) => {
                const hasCostDiff = item.cost !== undefined && item.currentCost !== undefined && 
                                    item.currentCost > 0 && Math.abs(item.cost - item.currentCost) > 0.001;
                const hasVendorDiff = vendorId && item.currentVendorName && 
                                      vendors.find(v => v.id === vendorId)?.name !== item.currentVendorName;
                const selectedVendorName = vendors.find(v => v.id === vendorId)?.name;
                
                return (
                  <div key={idx} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.itemName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400">+{item.quantity}</span>
                        {item.cost !== undefined && (
                          <span className="text-blue-400">{formatCurrency(item.cost)}/ea</span>
                        )}
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Price Difference Alert */}
                    {hasCostDiff && (
                      <div className="mt-2 p-2 bg-amber-900/30 border border-amber-700/50 rounded">
                        <div className="flex items-center gap-2 text-sm text-amber-300">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>
                            Cost difference: Current <strong>{formatCurrency(item.currentCost!)}</strong>
                            <ArrowRight className="h-3 w-3 inline mx-1" />
                            New <strong>{formatCurrency(item.cost!)}</strong>
                          </span>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-amber-200/70 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.updateCost || false}
                            onChange={() => toggleUpdateCost(idx)}
                            className="rounded bg-gray-800 border-gray-600"
                          />
                          Update master item cost to new price
                        </label>
                      </div>
                    )}
                    
                    {/* Vendor Difference Alert */}
                    {hasVendorDiff && (
                      <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded">
                        <div className="flex items-center gap-2 text-sm text-blue-300">
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          <span>
                            Different vendor: Current <strong>{item.currentVendorName}</strong>
                            <ArrowRight className="h-3 w-3 inline mx-1" />
                            New <strong>{selectedVendorName}</strong>
                          </span>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-blue-200/70 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.updateVendor || false}
                            onChange={() => toggleUpdateVendor(idx)}
                            className="rounded bg-gray-800 border-gray-600"
                          />
                          Update master item vendor to new vendor
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Notes (Optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice #, PO #, etc."
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={receiveItems.length === 0 || saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Log Shipment"}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Detail Modal */}
      <Modal
        isOpen={!!detailLog}
        onClose={() => setDetailLog(null)}
        title="Shipment Details"
      >
        {detailLog && (
          <div className="space-y-4">
            <div className="text-sm text-gray-400">
              {detailLog.vendor && <p>Vendor: {detailLog.vendor.name}</p>}
              <p>Date: {new Date(detailLog.createdAt).toLocaleString()}</p>
              {detailLog.invoiceImageUrl && <p>Notes: {detailLog.invoiceImageUrl}</p>}
            </div>
            
            <div className="border border-gray-700 rounded-lg divide-y divide-gray-700">
              {parseItemsJson(detailLog.itemsJson).map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <span>{item.itemName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-green-400 font-medium">+{item.quantity}</span>
                    {item.cost !== undefined && (
                      <span className="text-blue-400">${item.cost.toFixed(2)}/ea</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <Button onClick={() => setDetailLog(null)} className="w-full">
              Close
            </Button>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
