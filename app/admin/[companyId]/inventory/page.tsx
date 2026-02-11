"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, Search, Edit2, Trash2, Package, Scale } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";
import { motion } from "framer-motion";

interface Category {
  id: string;
  name: string;
  taxRate: number;
}

interface Vendor {
  id: string;
  name: string;
}

interface Item {
  id: string;
  barcode: string;
  name: string;
  price: number;
  cost: number;
  categoryId: string | null;
  category: Category | null;
  vendorId: string | null;
  vendor: Vendor | null;
  reorderPoint: number;
  isWeightPriced: boolean;
  quantityOnHand: number;
  imageUrl: string | null;
}

export default function InventoryPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    price: "",
    cost: "",
    categoryId: "",
    vendorId: "",
    reorderPoint: "0",
    isWeightPriced: false,
    quantityOnHand: "0",
  });
  
  useEffect(() => {
    fetchData();
  }, [companyId]);
  
  const fetchData = async () => {
    try {
      const [itemsRes, categoriesRes, vendorsRes] = await Promise.all([
        fetch(`/api/companies/${companyId}/items`),
        fetch(`/api/companies/${companyId}/categories`),
        fetch(`/api/companies/${companyId}/vendors`),
      ]);
      const [itemsData, categoriesData, vendorsData] = await Promise.all([
        itemsRes.json(),
        categoriesRes.json(),
        vendorsRes.json(),
      ]);
      setItems(itemsData ?? []);
      setCategories(categoriesData ?? []);
      setVendors(vendorsData ?? []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const openModal = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        barcode: item.barcode,
        name: item.name,
        price: item.price.toString(),
        cost: item.cost.toString(),
        categoryId: item.categoryId || "",
        vendorId: item.vendorId || "",
        reorderPoint: item.reorderPoint.toString(),
        isWeightPriced: item.isWeightPriced,
        quantityOnHand: item.quantityOnHand.toString(),
      });
    } else {
      setEditingItem(null);
      setFormData({
        barcode: "",
        name: "",
        price: "",
        cost: "",
        categoryId: "",
        vendorId: "",
        reorderPoint: "0",
        isWeightPriced: false,
        quantityOnHand: "0",
      });
    }
    setError("");
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setError("");
  };
  
  const saveItem = async () => {
    if (!formData.barcode.trim() || !formData.name.trim() || !formData.price) {
      setError("Barcode, name, and price are required");
      return;
    }
    
    setSaving(true);
    setError("");
    
    try {
      const url = editingItem
        ? `/api/items/${editingItem.id}`
        : `/api/companies/${companyId}/items`;
      const method = editingItem ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to save item");
      }
      
      closeModal();
      fetchData();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save item");
    } finally {
      setSaving(false);
    }
  };
  
  const deleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this item?")) return;
    
    try {
      await fetch(`/api/items/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };
  
  const filteredItems = (items ?? []).filter((item) =>
    item?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase() ?? "") ||
    item?.barcode?.toLowerCase()?.includes(searchQuery?.toLowerCase() ?? "")
  );
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="text-gray-400 mt-1">Manage your products</p>
          </div>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No items found</h2>
            <p className="text-gray-500 mt-2">
              {searchQuery ? "Try a different search" : "Add your first item to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Barcode</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Price</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Category</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Qty</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <motion.tr
                    key={item?.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4 font-mono text-sm">{item?.barcode}</td>
                    <td className="py-3 px-4 font-medium">{item?.name}</td>
                    <td className="py-3 px-4">{formatCurrency(item?.price)}</td>
                    <td className="py-3 px-4 text-gray-400">{item?.category?.name ?? "-"}</td>
                    <td className="py-3 px-4">{item?.quantityOnHand}</td>
                    <td className="py-3 px-4">
                      {item?.isWeightPriced && (
                        <span className="inline-flex items-center gap-1 text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                          <Scale className="h-3 w-3" />
                          Weight
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openModal(item)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteItem(item.id)}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingItem ? "Edit Item" : "Add New Item"}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Barcode *</label>
            <Input
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Enter barcode"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter name"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Price *</label>
            <Input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cost</label>
            <Input
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              placeholder="0.00"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full h-10 rounded-md border border-gray-600 bg-gray-800 px-3 text-white"
            >
              <option value="">Select category</option>
              {(categories ?? []).map((cat) => (
                <option key={cat?.id} value={cat?.id}>{cat?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Vendor</label>
            <select
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
              className="w-full h-10 rounded-md border border-gray-600 bg-gray-800 px-3 text-white"
            >
              <option value="">Select vendor</option>
              {(vendors ?? []).map((vendor) => (
                <option key={vendor?.id} value={vendor?.id}>{vendor?.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Reorder Point (Par Level)</label>
            <Input
              type="number"
              value={formData.reorderPoint}
              onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
              placeholder="0"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quantity on Hand</label>
            <Input
              type="number"
              value={formData.quantityOnHand}
              onChange={(e) => setFormData({ ...formData, quantityOnHand: e.target.value })}
              placeholder="0"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isWeightPriced}
                onChange={(e) => setFormData({ ...formData, isWeightPriced: e.target.checked })}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm text-gray-300">This item is sold by weight (price per lb)</span>
            </label>
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        <div className="flex gap-3 justify-end mt-6">
          <Button
            variant="outline"
            onClick={closeModal}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button onClick={saveItem} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <LoadingSpinner size="sm" /> : editingItem ? "Update" : "Create"}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}