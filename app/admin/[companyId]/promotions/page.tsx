"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  SearchableItemSelect,
  SearchableItemMultiSelect,
} from "@/components/searchable-item-select";
import {
  Plus,
  Pencil,
  Trash2,
  Gift,
  Tag,
  Package,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { motion } from "framer-motion";

interface Promotion {
  id: string;
  name: string;
  type: string;
  configJson: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  barcode: string;
}

const PROMOTION_TYPES = [
  { value: "bogo", label: "BOGO (Buy One Get One)", icon: Gift },
  { value: "sale", label: "Sale (% or $ Off)", icon: Tag },
  { value: "bundle", label: "Buy X for $X", icon: Package },
];

export default function PromotionsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("bogo");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  
  // Config state based on type
  const [bogoTriggerQty, setBogoTriggerQty] = useState(1);
  const [bogoFreeQty, setBogoFreeQty] = useState(1);
  const [bogoPercentOff, setBogoPercentOff] = useState(100);
  const [bogoAppliesTo, setBogoAppliesTo] = useState("item");
  const [bogoItemId, setBogoItemId] = useState("");
  const [bogoCategoryId, setBogoCategoryId] = useState("");
  
  const [saleDiscountType, setSaleDiscountType] = useState("percent");
  const [saleDiscountValue, setSaleDiscountValue] = useState(0);
  const [saleAppliesTo, setSaleAppliesTo] = useState("items");
  const [saleSelectedItems, setSaleSelectedItems] = useState<string[]>([]);
  const [saleCategoryId, setSaleCategoryId] = useState("");
  
  const [bundleQty, setBundleQty] = useState(2);
  const [bundlePrice, setBundlePrice] = useState(0);
  const [bundleAppliesTo, setBundleAppliesTo] = useState("item");
  const [bundleItemId, setBundleItemId] = useState("");
  const [bundleCategoryId, setBundleCategoryId] = useState("");
  
  useEffect(() => {
    fetchData();
  }, [companyId]);
  
  const fetchData = async () => {
    try {
      const [promoRes, catRes, itemRes] = await Promise.all([
        fetch(`/api/promotions?companyId=${companyId}`),
        fetch(`/api/categories?companyId=${companyId}`),
        fetch(`/api/items?companyId=${companyId}`),
      ]);
      
      const [promos, cats, itms] = await Promise.all([
        promoRes.json(),
        catRes.json(),
        itemRes.json(),
      ]);
      
      setPromotions(Array.isArray(promos) ? promos : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setItems(Array.isArray(itms) ? itms : []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setName("");
    setType("bogo");
    setStartDate("");
    setEndDate("");
    setIsActive(true);
    setBogoTriggerQty(1);
    setBogoFreeQty(1);
    setBogoPercentOff(100);
    setBogoAppliesTo("item");
    setBogoItemId("");
    setBogoCategoryId("");
    setSaleDiscountType("percent");
    setSaleDiscountValue(0);
    setSaleAppliesTo("items");
    setSaleSelectedItems([]);
    setSaleCategoryId("");
    setBundleQty(2);
    setBundlePrice(0);
    setBundleAppliesTo("item");
    setBundleItemId("");
    setBundleCategoryId("");
  };
  
  const openCreateModal = () => {
    setEditingPromo(null);
    resetForm();
    setModalOpen(true);
  };
  
  const openEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setName(promo.name);
    setType(promo.type);
    setStartDate(promo.startDate ? promo.startDate.slice(0, 10) : "");
    setEndDate(promo.endDate ? promo.endDate.slice(0, 10) : "");
    setIsActive(promo.isActive);
    
    if (promo.configJson) {
      const config = JSON.parse(promo.configJson);
      if (promo.type === "bogo") {
        setBogoTriggerQty(config.triggerQty || 1);
        setBogoFreeQty(config.freeQty || 1);
        setBogoPercentOff(config.percentOff ?? 100);
        setBogoAppliesTo(config.appliesTo || "item");
        setBogoItemId(config.itemId || "");
        setBogoCategoryId(config.categoryId || "");
      } else if (promo.type === "sale") {
        setSaleDiscountType(config.discountType || "percent");
        setSaleDiscountValue(config.discountValue || 0);
        setSaleAppliesTo(config.appliesTo || "items");
        setSaleSelectedItems(config.itemIds || []);
        setSaleCategoryId(config.categoryId || "");
      } else if (promo.type === "bundle") {
        setBundleQty(config.qty || 2);
        setBundlePrice(config.price || 0);
        setBundleAppliesTo(config.appliesTo || "item");
        setBundleItemId(config.itemId || "");
        setBundleCategoryId(config.categoryId || "");
      }
    }
    
    setModalOpen(true);
  };
  
  const getConfigJson = () => {
    if (type === "bogo") {
      return {
        triggerQty: bogoTriggerQty,
        freeQty: bogoFreeQty,
        percentOff: bogoPercentOff,
        appliesTo: bogoAppliesTo,
        itemId: bogoAppliesTo === "item" ? bogoItemId : null,
        categoryId: bogoAppliesTo === "category" ? bogoCategoryId : null,
      };
    } else if (type === "sale") {
      return {
        discountType: saleDiscountType,
        discountValue: saleDiscountValue,
        appliesTo: saleAppliesTo,
        itemIds: saleAppliesTo === "items" ? saleSelectedItems : [],
        categoryId: saleAppliesTo === "category" ? saleCategoryId : null,
      };
    } else if (type === "bundle") {
      return {
        qty: bundleQty,
        price: bundlePrice,
        appliesTo: bundleAppliesTo,
        itemId: bundleAppliesTo === "item" ? bundleItemId : null,
        categoryId: bundleAppliesTo === "category" ? bundleCategoryId : null,
      };
    }
    return {};
  };
  
  const handleSave = async () => {
    if (!name.trim()) return;
    
    const payload = {
      companyId,
      name,
      type,
      configJson: getConfigJson(),
      startDate: startDate || null,
      endDate: endDate || null,
      isActive,
    };
    
    try {
      if (editingPromo) {
        await fetch(`/api/promotions/${editingPromo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/promotions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      
      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Save error:", err);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this promotion?")) return;
    
    try {
      await fetch(`/api/promotions/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };
  
  const toggleActive = async (promo: Promotion) => {
    try {
      await fetch(`/api/promotions/${promo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      fetchData();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };
  
  const getPromoTypeLabel = (t: string) => {
    return PROMOTION_TYPES.find((pt) => pt.value === t)?.label || t;
  };
  
  const getPromoDescription = (promo: Promotion) => {
    if (!promo.configJson) return "";
    const config = JSON.parse(promo.configJson);
    
    if (promo.type === "bogo") {
      const pct = config.percentOff ?? 100;
      if (pct === 100) {
        return `Buy ${config.triggerQty}, Get ${config.freeQty} Free`;
      }
      return `Buy ${config.triggerQty}, Get ${config.freeQty} at ${pct}% Off`;
    } else if (promo.type === "sale") {
      return config.discountType === "percent"
        ? `${config.discountValue}% Off`
        : `$${config.discountValue} Off`;
    } else if (promo.type === "bundle") {
      return `Buy ${config.qty} for $${config.price}`;
    }
    return "";
  };
  
  const toggleSaleItem = (itemId: string) => {
    setSaleSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
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
            <h1 className="text-2xl font-bold">Promotions</h1>
            <p className="text-gray-400">Manage deals, discounts, and special offers</p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Promotion
          </Button>
        </div>
        
        <div className="grid gap-4">
          {promotions.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
              <Gift className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No promotions yet</p>
              <Button onClick={openCreateModal} variant="link" className="mt-2">
                Create your first promotion
              </Button>
            </div>
          ) : (
            promotions.map((promo, index) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 rounded-lg border ${
                  promo.isActive
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-gray-900/50 border-gray-800 opacity-60"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    promo.type === "bogo" ? "bg-pink-600/20 text-pink-400" :
                    promo.type === "sale" ? "bg-green-600/20 text-green-400" :
                    "bg-blue-600/20 text-blue-400"
                  }`}>
                    {promo.type === "bogo" ? <Gift className="h-5 w-5" /> :
                     promo.type === "sale" ? <Tag className="h-5 w-5" /> :
                     <Package className="h-5 w-5" />}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold">{promo.name}</h3>
                    <p className="text-sm text-gray-400">
                      {getPromoTypeLabel(promo.type)} • {getPromoDescription(promo)}
                    </p>
                    {(promo.startDate || promo.endDate) && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {promo.startDate ? new Date(promo.startDate).toLocaleDateString() : "Anytime"}
                        {" - "}
                        {promo.endDate ? new Date(promo.endDate).toLocaleDateString() : "Ongoing"}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(promo)}
                      className={promo.isActive ? "text-green-400" : "text-gray-500"}
                    >
                      {promo.isActive ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(promo)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(promo.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
      
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPromo ? "Edit Promotion" : "Create Promotion"}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer Sale, BOGO Drinks, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {PROMOTION_TYPES.map((pt) => {
                const Icon = pt.icon;
                return (
                  <button
                    key={pt.value}
                    onClick={() => setType(pt.value)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      type === pt.value
                        ? "border-blue-500 bg-blue-500/20 text-blue-400"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-xs">{pt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* BOGO Config */}
          {type === "bogo" && (
            <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Buy Qty</label>
                  <Input
                    type="number"
                    min="1"
                    value={bogoTriggerQty}
                    onChange={(e) => setBogoTriggerQty(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Get Qty</label>
                  <Input
                    type="number"
                    min="1"
                    value={bogoFreeQty}
                    onChange={(e) => setBogoFreeQty(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">% Off</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={bogoPercentOff}
                    onChange={(e) => setBogoPercentOff(parseInt(e.target.value) || 100)}
                    placeholder="100 = free"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {bogoPercentOff === 100 ? "Get item(s) FREE" : `Get item(s) at ${bogoPercentOff}% off`}
              </p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Applies To</label>
                <select
                  value={bogoAppliesTo}
                  onChange={(e) => setBogoAppliesTo(e.target.value)}
                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="item">Specific Item</option>
                  <option value="category">Category</option>
                </select>
              </div>
              {bogoAppliesTo === "item" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Select Item</label>
                  <SearchableItemSelect
                    items={items}
                    selectedId={bogoItemId}
                    onSelect={setBogoItemId}
                    placeholder="Search by name or barcode..."
                  />
                </div>
              )}
              {bogoAppliesTo === "category" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Select Category</label>
                  <select
                    value={bogoCategoryId}
                    onChange={(e) => setBogoCategoryId(e.target.value)}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          
          {/* Sale Config */}
          {type === "sale" && (
            <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Discount Type</label>
                  <select
                    value={saleDiscountType}
                    onChange={(e) => setSaleDiscountType(e.target.value)}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {saleDiscountType === "percent" ? "% Off" : "$ Off"}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step={saleDiscountType === "percent" ? "1" : "0.01"}
                    value={saleDiscountValue}
                    onChange={(e) => setSaleDiscountValue(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Applies To</label>
                <select
                  value={saleAppliesTo}
                  onChange={(e) => setSaleAppliesTo(e.target.value)}
                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="items">Selected Items</option>
                  <option value="category">Category</option>
                  <option value="all">All Items</option>
                </select>
              </div>
              {saleAppliesTo === "items" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Select Items</label>
                  <SearchableItemMultiSelect
                    items={items}
                    selectedIds={saleSelectedItems}
                    onToggle={toggleSaleItem}
                    placeholder="Search by name or barcode..."
                  />
                </div>
              )}
              {saleAppliesTo === "category" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Select Category</label>
                  <select
                    value={saleCategoryId}
                    onChange={(e) => setSaleCategoryId(e.target.value)}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          
          {/* Bundle Config */}
          {type === "bundle" && (
            <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Buy Quantity</label>
                  <Input
                    type="number"
                    min="2"
                    value={bundleQty}
                    onChange={(e) => setBundleQty(parseInt(e.target.value) || 2)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">For Price ($)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bundlePrice}
                    onChange={(e) => setBundlePrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Applies To</label>
                <select
                  value={bundleAppliesTo}
                  onChange={(e) => setBundleAppliesTo(e.target.value)}
                  className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                >
                  <option value="item">Specific Item</option>
                  <option value="category">Category</option>
                </select>
              </div>
              {bundleAppliesTo === "item" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Select Item</label>
                  <SearchableItemSelect
                    items={items}
                    selectedId={bundleItemId}
                    onSelect={setBundleItemId}
                    placeholder="Search by name or barcode..."
                  />
                </div>
              )}
              {bundleAppliesTo === "category" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Select Category</label>
                  <select
                    value={bundleCategoryId}
                    onChange={(e) => setBundleCategoryId(e.target.value)}
                    className="w-full p-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="isActive" className="text-sm">Active</label>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              {editingPromo ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
