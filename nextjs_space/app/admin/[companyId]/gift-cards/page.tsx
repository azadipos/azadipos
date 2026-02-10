"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CreditCard, Plus, Search, Eye, DollarSign, Calendar, Barcode, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";
import { motion } from "framer-motion";

interface GiftCard {
  id: string;
  barcode: string;
  initialValue: number;
  balance: number;
  isActive: boolean;
  purchasedAt: string | null;
  purchaseTransactionId: string | null;
  createdAt: string;
  usageHistory: { id: string; amount: number; balanceAfter: number; createdAt: string }[];
}

export default function GiftCardsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  
  // Detail modal
  const [detailCard, setDetailCard] = useState<GiftCard | null>(null);
  
  useEffect(() => {
    fetchGiftCards();
  }, [companyId]);
  
  const fetchGiftCards = async () => {
    try {
      const res = await fetch(`/api/gift-cards?companyId=${companyId}`);
      const data = await res.json();
      setGiftCards(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch gift cards:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = async () => {
    if (!newBarcode || !newValue) return;
    setCreating(true);
    setCreateError("");
    
    try {
      const res = await fetch("/api/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          barcode: newBarcode,
          initialValue: parseFloat(newValue),
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create gift card");
      }
      
      setCreateModalOpen(false);
      setNewBarcode("");
      setNewValue("");
      fetchGiftCards();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };
  
  const generateBarcode = () => {
    const prefix = "GC";
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    setNewBarcode(`${prefix}-${random}`);
  };
  
  const filteredCards = giftCards.filter(card =>
    card.barcode.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalValue = giftCards.reduce((sum, card) => sum + card.balance, 0);
  const activeCards = giftCards.filter(card => card.isActive && card.balance > 0).length;
  
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
            <h1 className="text-2xl font-bold">Gift Cards</h1>
            <p className="text-gray-400">Manage gift card inventory</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Gift Card
          </Button>
        </div>
        
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 bg-indigo-600/20 border border-indigo-600/30 rounded-lg">
            <p className="text-sm text-indigo-400">Total Cards</p>
            <p className="text-2xl font-bold mt-1">{giftCards.length}</p>
          </div>
          <div className="p-4 bg-green-600/20 border border-green-600/30 rounded-lg">
            <p className="text-sm text-green-400">Active with Balance</p>
            <p className="text-2xl font-bold mt-1">{activeCards}</p>
          </div>
          <div className="p-4 bg-blue-600/20 border border-blue-600/30 rounded-lg">
            <p className="text-sm text-blue-400">Total Liability</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by barcode..."
            className="pl-10 bg-gray-800 border-gray-600"
          />
        </div>
        
        {/* Gift Cards List */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <CreditCard className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {searchQuery ? "No gift cards match your search" : "No gift cards created yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCards.map((card, idx) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`p-4 bg-gray-800/50 border rounded-lg flex items-center justify-between ${
                  card.balance === 0 ? 'border-gray-700/50 opacity-60' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    card.balance > 0 ? 'bg-indigo-600/20' : 'bg-gray-600/20'
                  }`}>
                    <CreditCard className={`h-5 w-5 ${
                      card.balance > 0 ? 'text-indigo-400' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <p className="font-mono font-medium">{card.barcode}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                      <span>Initial: {formatCurrency(card.initialValue)}</span>
                      <span className={card.purchasedAt ? 'text-green-400' : 'text-amber-400'}>
                        {card.purchasedAt ? 'Sold' : 'Not sold'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Balance</p>
                    <p className={`text-xl font-bold ${
                      card.balance > 0 ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      {formatCurrency(card.balance)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailCard(card)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setNewBarcode("");
          setNewValue("");
          setCreateError("");
        }}
        title="Create Gift Card"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg text-sm text-blue-200/70">
            Create a gift card that can be sold at the POS. When scanned for the first time, it will be activated and sold to the customer.
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Barcode</label>
            <div className="flex gap-2">
              <Input
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                placeholder="GC-XXXXXXXX"
                className="bg-gray-800 border-gray-600 font-mono"
              />
              <Button variant="outline" onClick={generateBarcode} className="border-gray-600">
                Generate
              </Button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Value</label>
            <Input
              type="number"
              step="0.01"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="25.00"
              className="bg-gray-800 border-gray-600"
            />
          </div>
          
          {createError && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
              {createError}
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newBarcode || !newValue} className="flex-1">
              {creating ? <LoadingSpinner size="sm" /> : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Detail Modal */}
      <Modal
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
        title="Gift Card Details"
      >
        {detailCard && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Barcode className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-400">Barcode</span>
              </div>
              <p className="font-mono text-lg">{detailCard.barcode}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Initial Value</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(detailCard.initialValue)}</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-gray-400">Current Balance</span>
                </div>
                <p className={`text-xl font-bold ${
                  detailCard.balance > 0 ? 'text-green-400' : 'text-gray-500'
                }`}>
                  {formatCurrency(detailCard.balance)}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-400">Status</span>
              </div>
              <p>
                {detailCard.purchasedAt 
                  ? `Sold on ${new Date(detailCard.purchasedAt).toLocaleString()}`
                  : 'Not yet sold'
                }
              </p>
            </div>
            
            {detailCard.usageHistory && detailCard.usageHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Usage History</h4>
                <div className="border border-gray-700 rounded-lg divide-y divide-gray-700 max-h-48 overflow-auto">
                  {detailCard.usageHistory.map((usage) => (
                    <div key={usage.id} className="p-3 flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        {new Date(usage.createdAt).toLocaleString()}
                      </span>
                      <div className="text-right">
                        <span className="text-red-400">-{formatCurrency(usage.amount)}</span>
                        <span className="text-gray-500 ml-2">
                          → {formatCurrency(usage.balanceAfter)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <Button onClick={() => setDetailCard(null)} className="w-full">
              Close
            </Button>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
