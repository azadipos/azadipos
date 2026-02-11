"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, Edit2, Trash2, Tags, Percent } from "lucide-react";
import { motion } from "framer-motion";

interface Category {
  id: string;
  name: string;
  taxRate: number;
  isAgeRestricted: boolean;
  returnPeriodDays: number;
}

export default function CategoriesPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    taxRate: "0",
    isAgeRestricted: false,
    returnPeriodDays: "30",
  });
  
  useEffect(() => {
    fetchCategories();
  }, [companyId]);
  
  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/categories`);
      const data = await res.json();
      setCategories(data ?? []);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        taxRate: category.taxRate.toString(),
        isAgeRestricted: category.isAgeRestricted,
        returnPeriodDays: category.returnPeriodDays.toString(),
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", taxRate: "0", isAgeRestricted: false, returnPeriodDays: "30" });
    }
    setError("");
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setError("");
  };
  
  const saveCategory = async () => {
    if (!formData.name.trim()) {
      setError("Category name is required");
      return;
    }
    
    setSaving(true);
    setError("");
    
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : `/api/companies/${companyId}/categories`;
      const method = editingCategory ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          taxRate: parseFloat(formData.taxRate) || 0,
          isAgeRestricted: formData.isAgeRestricted,
          returnPeriodDays: parseInt(formData.returnPeriodDays) || 30,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to save category");
      }
      
      closeModal();
      fetchCategories();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save category");
    } finally {
      setSaving(false);
    }
  };
  
  const deleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    
    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
      fetchCategories();
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Categories</h1>
            <p className="text-gray-400 mt-1">Organize items and set tax rates</p>
          </div>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : (categories?.length ?? 0) === 0 ? (
          <div className="text-center py-20">
            <Tags className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No categories yet</h2>
            <p className="text-gray-500 mt-2">Create categories to organize your items</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories?.map((category, index) => (
              <motion.div
                key={category?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{category?.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-sm bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
                        <Percent className="h-3 w-3" />
                        {category?.taxRate}% tax
                      </span>
                      {category?.isAgeRestricted && (
                        <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">
                          Age Restricted
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openModal(category)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCategory(category.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      <Modal isOpen={showModal} onClose={closeModal} title={editingCategory ? "Edit Category" : "Add Category"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter category name"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tax Rate (%)</label>
            <Input
              type="number"
              step="0.01"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              placeholder="0"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAgeRestricted}
                onChange={(e) => setFormData({ ...formData, isAgeRestricted: e.target.checked })}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm text-gray-300">Age restricted (requires ID check)</span>
            </label>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal} className="border-gray-600 text-gray-300 hover:bg-gray-800">
              Cancel
            </Button>
            <Button onClick={saveCategory} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <LoadingSpinner size="sm" /> : editingCategory ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}