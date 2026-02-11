"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, Edit2, Trash2, Truck } from "lucide-react";
import { motion } from "framer-motion";

interface Vendor {
  id: string;
  name: string;
  contactInfo: string | null;
}

export default function VendorsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({ name: "", contactInfo: "" });
  
  useEffect(() => {
    fetchVendors();
  }, [companyId]);
  
  const fetchVendors = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/vendors`);
      const data = await res.json();
      setVendors(data ?? []);
    } catch (err) {
      console.error("Failed to fetch vendors:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const openModal = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({ name: vendor.name, contactInfo: vendor.contactInfo || "" });
    } else {
      setEditingVendor(null);
      setFormData({ name: "", contactInfo: "" });
    }
    setError("");
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setEditingVendor(null);
    setError("");
  };
  
  const saveVendor = async () => {
    if (!formData.name.trim()) {
      setError("Vendor name is required");
      return;
    }
    
    setSaving(true);
    setError("");
    
    try {
      const url = editingVendor
        ? `/api/vendors/${editingVendor.id}`
        : `/api/companies/${companyId}/vendors`;
      const method = editingVendor ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to save vendor");
      }
      
      closeModal();
      fetchVendors();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };
  
  const deleteVendor = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vendor?")) return;
    
    try {
      await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      fetchVendors();
    } catch (err) {
      console.error("Failed to delete vendor:", err);
    }
  };
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendors</h1>
            <p className="text-gray-400 mt-1">Manage your suppliers</p>
          </div>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : (vendors?.length ?? 0) === 0 ? (
          <div className="text-center py-20">
            <Truck className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No vendors yet</h2>
            <p className="text-gray-500 mt-2">Add vendors to track suppliers</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendors?.map((vendor, index) => (
              <motion.div
                key={vendor?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{vendor?.name}</h3>
                    {vendor?.contactInfo && (
                      <p className="text-sm text-gray-400 mt-1">{vendor.contactInfo}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openModal(vendor)} className="text-gray-400 hover:text-white">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteVendor(vendor.id)} className="text-gray-400 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      <Modal isOpen={showModal} onClose={closeModal} title={editingVendor ? "Edit Vendor" : "Add Vendor"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter vendor name"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Contact Info</label>
            <Input
              value={formData.contactInfo}
              onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
              placeholder="Phone, email, or address"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal} className="border-gray-600 text-gray-300 hover:bg-gray-800">
              Cancel
            </Button>
            <Button onClick={saveVendor} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <LoadingSpinner size="sm" /> : editingVendor ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}