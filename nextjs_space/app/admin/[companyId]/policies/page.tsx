"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SearchableItemSelect } from "@/components/searchable-item-select";
import { ShieldCheck, Save, Plus, Trash2, Clock, Ban, Package, Tag, Info } from "lucide-react";
import { motion } from "framer-motion";

interface Category {
  id: string;
  name: string;
  returnPeriodDays: number;
}

interface ItemWithPolicy {
  id: string;
  name: string;
  barcode: string;
  returnPeriodDays: number | null;
  noReturns: boolean;
  category: { name: string } | null;
}

interface Item {
  id: string;
  name: string;
  barcode: string;
}

export default function PoliciesPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultReturnDays, setDefaultReturnDays] = useState(30);
  const [categories, setCategories] = useState<Category[]>([]);
  const [itemsWithCustomPolicy, setItemsWithCustomPolicy] = useState<ItemWithPolicy[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  
  // Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemReturnDays, setItemReturnDays] = useState<string>("");
  const [itemNoReturns, setItemNoReturns] = useState(false);
  
  // Category edit
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDaysInput, setCategoryDaysInput] = useState<string>("");
  
  useEffect(() => {
    fetchPolicies();
    fetchAllItems();
  }, [companyId]);
  
  const fetchPolicies = async () => {
    try {
      const res = await fetch(`/api/policies?companyId=${companyId}`);
      const data = await res.json();
      setDefaultReturnDays(data.defaultReturnPeriodDays || 30);
      setCategories(data.categories || []);
      setItemsWithCustomPolicy(data.itemsWithCustomPolicy || []);
    } catch (err) {
      console.error("Failed to fetch policies:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAllItems = async () => {
    try {
      const res = await fetch(`/api/items?companyId=${companyId}&limit=10000`);
      const data = await res.json();
      setAllItems(data || []);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    }
  };
  
  const saveDefaultReturnDays = async () => {
    setSaving(true);
    try {
      await fetch("/api/policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, defaultReturnPeriodDays: defaultReturnDays }),
      });
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };
  
  const saveCategoryPolicy = async (categoryId: string, days: number) => {
    try {
      await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          targetType: "category",
          targetId: categoryId,
          returnPeriodDays: days,
        }),
      });
      setEditingCategory(null);
      fetchPolicies();
    } catch (err) {
      console.error("Failed to save category policy:", err);
    }
  };
  
  const saveItemPolicy = async () => {
    if (!selectedItem) return;
    
    try {
      await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          targetType: "item",
          targetId: selectedItem.id,
          returnPeriodDays: itemNoReturns ? null : parseInt(itemReturnDays) || null,
          noReturns: itemNoReturns,
        }),
      });
      setShowItemModal(false);
      setSelectedItem(null);
      setItemReturnDays("");
      setItemNoReturns(false);
      fetchPolicies();
    } catch (err) {
      console.error("Failed to save item policy:", err);
    }
  };
  
  const removeItemPolicy = async (item: ItemWithPolicy) => {
    try {
      await fetch(`/api/policies?targetType=item&targetId=${item.id}`, {
        method: "DELETE",
      });
      fetchPolicies();
    } catch (err) {
      console.error("Failed to remove policy:", err);
    }
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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-slate-400" />
            Return Policies
          </h1>
          <p className="text-gray-400 mt-1">Configure return periods and restrictions</p>
        </div>
        
        {/* Info Banner */}
        <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-lg">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-blue-400">How return policies work:</p>
              <ul className="mt-2 space-y-1 text-gray-400">
                <li>• <strong>Default period</strong> applies to all items without custom rules</li>
                <li>• <strong>Category rules</strong> override the default for items in that category</li>
                <li>• <strong>Item rules</strong> have highest priority and override everything else</li>
                <li>• Items marked as &quot;No Returns&quot; cannot be returned regardless of timing</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Default Return Period */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Default Return Period
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            This applies to all transactions unless overridden by category or item-specific rules.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="365"
                value={defaultReturnDays}
                onChange={(e) => setDefaultReturnDays(parseInt(e.target.value) || 0)}
                className="w-24 bg-gray-800 border-gray-600 text-white text-center"
              />
              <span className="text-gray-400">days</span>
            </div>
            <Button
              onClick={saveDefaultReturnDays}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </motion.div>
        
        {/* Category Policies */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-400" />
            Category Return Periods
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Override the default return period for entire categories.
          </p>
          
          {categories.length === 0 ? (
            <p className="text-gray-500 text-sm">No categories configured yet.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                >
                  <span className="font-medium">{category.name}</span>
                  <div className="flex items-center gap-3">
                    {editingCategory === category.id ? (
                      <>
                        <Input
                          type="number"
                          min="0"
                          max="365"
                          value={categoryDaysInput}
                          onChange={(e) => setCategoryDaysInput(e.target.value)}
                          className="w-20 h-8 bg-gray-800 border-gray-600 text-white text-center text-sm"
                          autoFocus
                        />
                        <span className="text-gray-400 text-sm">days</span>
                        <Button
                          size="sm"
                          onClick={() => saveCategoryPolicy(category.id, parseInt(categoryDaysInput) || 30)}
                          className="h-8 bg-green-600 hover:bg-green-700"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCategory(null)}
                          className="h-8"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-green-400 font-mono">
                          {category.returnPeriodDays} days
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCategory(category.id);
                            setCategoryDaysInput(String(category.returnPeriodDays));
                          }}
                          className="h-8 text-gray-400 hover:text-white"
                        >
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
        
        {/* Item-Specific Policies */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-400" />
                Item-Specific Rules
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Set custom return periods or mark items as non-returnable.
              </p>
            </div>
            <Button
              onClick={() => setShowItemModal(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item Rule
            </Button>
          </div>
          
          {itemsWithCustomPolicy.length === 0 ? (
            <p className="text-gray-500 text-sm">No item-specific rules configured.</p>
          ) : (
            <div className="space-y-2">
              {itemsWithCustomPolicy.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-gray-500 text-sm ml-2">({item.barcode})</span>
                    {item.category && (
                      <span className="text-gray-600 text-xs ml-2">• {item.category.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {item.noReturns ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <Ban className="h-4 w-4" />
                        No Returns
                      </span>
                    ) : (
                      <span className="text-yellow-400 font-mono">
                        {item.returnPeriodDays} days
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItemPolicy(item)}
                      className="h-8 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      
      {/* Add Item Rule Modal */}
      <Modal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false);
          setSelectedItem(null);
          setItemReturnDays("");
          setItemNoReturns(false);
        }}
        title="Add Item Return Rule"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select Item</label>
            <SearchableItemSelect
              items={allItems.filter(
                (i) => !itemsWithCustomPolicy.some((p) => p.id === i.id)
              )}
              selectedId={selectedItem?.id}
              onSelect={(id) => setSelectedItem(allItems.find(i => i.id === id) || null)}
              placeholder="Search by name or barcode..."
            />
          </div>
          
          {selectedItem && (
            <>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemNoReturns}
                    onChange={(e) => setItemNoReturns(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-red-600"
                  />
                  <span className="text-sm text-gray-300 flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-400" />
                    No returns allowed (Final Sale)
                  </span>
                </label>
              </div>
              
              {!itemNoReturns && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Custom Return Period
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="365"
                      value={itemReturnDays}
                      onChange={(e) => setItemReturnDays(e.target.value)}
                      placeholder={String(defaultReturnDays)}
                      className="w-24 bg-gray-800 border-gray-600 text-white text-center"
                    />
                    <span className="text-gray-400">days</span>
                    <span className="text-gray-500 text-sm ml-2">
                      (Default: {defaultReturnDays})
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowItemModal(false);
                setSelectedItem(null);
                setItemReturnDays("");
                setItemNoReturns(false);
              }}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={saveItemPolicy}
              disabled={!selectedItem}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Save Rule
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
