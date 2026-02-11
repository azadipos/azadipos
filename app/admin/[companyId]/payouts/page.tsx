"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatCurrency } from "@/lib/helpers";
import { DollarSign, Plus, Trash2, Calendar, Building2, FileText } from "lucide-react";
import { motion } from "framer-motion";

interface Payout {
  id: string;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  amount: number;
  receiptImageUrl: string | null;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
}

export default function PayoutsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Form state
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, [companyId]);
  
  const fetchData = async () => {
    try {
      const [payoutsRes, vendorsRes] = await Promise.all([
        fetch(`/api/payouts?companyId=${companyId}`),
        fetch(`/api/companies/${companyId}/vendors`),
      ]);
      const [payoutsData, vendorsData] = await Promise.all([
        payoutsRes.json(),
        vendorsRes.json(),
      ]);
      setPayouts(Array.isArray(payoutsData) ? payoutsData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = async () => {
    if (!amount) return;
    setSaving(true);
    try {
      await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          vendorId: vendorId || null,
          amount,
          notes,
        }),
      });
      setModalOpen(false);
      setVendorId("");
      setAmount("");
      setNotes("");
      fetchData();
    } catch (err) {
      console.error("Failed to create payout:", err);
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payout record?")) return;
    try {
      await fetch(`/api/payouts/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };
  
  const totalPayouts = payouts.reduce((sum: number, p: any) => sum + p.amount, 0);
  
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
            <h1 className="text-2xl font-bold">Payouts</h1>
            <p className="text-gray-400">Track payments to vendors and suppliers</p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Payout
          </Button>
        </div>
        
        {/* Summary */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600/20 rounded-lg">
              <DollarSign className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Payouts</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(totalPayouts)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-gray-400">{payouts.length} records</p>
            </div>
          </div>
        </div>
        
        {/* Payouts List */}
        <div className="space-y-3">
          {payouts.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
              <DollarSign className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No payouts recorded yet</p>
              <p className="text-sm text-gray-500">Click "Record Payout" to add one</p>
            </div>
          ) : (
            payouts.map((payout, idx) => (
              <motion.div
                key={payout.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-gray-800/50 rounded-lg border border-gray-700 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-700 rounded-lg">
                    <DollarSign className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {payout.vendor ? (
                        <span className="font-medium flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {payout.vendor.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">No vendor specified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(payout.createdAt).toLocaleDateString()}
                      </span>
                      {payout.receiptImageUrl && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {payout.receiptImageUrl}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-400">-{formatCurrency(payout.amount)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(payout.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
      
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Payout"
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
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Amount *</label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Notes (Optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice #, check #, etc."
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
              disabled={!amount || saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Record Payout"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
