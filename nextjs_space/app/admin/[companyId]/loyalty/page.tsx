"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Heart, Save, Plus, Trash2, Gift, DollarSign, Percent, Info, Settings } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";
import { motion } from "framer-motion";

interface RewardTier {
  points: number;
  type: "percent_off" | "cash_off" | "free_item";
  value: number;
  description?: string;
}

interface LoyaltyConfig {
  id: string;
  companyId: string;
  pointsPerDollar: number;
  rewardTiersJson: string | null;
  isEnabled: boolean;
}

export default function LoyaltyPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [isEnabled, setIsEnabled] = useState(true);
  const [pointsPerDollar, setPointsPerDollar] = useState("1");
  const [rewardTiers, setRewardTiers] = useState<RewardTier[]>([]);
  
  // Add tier modal
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [newTierPoints, setNewTierPoints] = useState("");
  const [newTierType, setNewTierType] = useState<RewardTier["type"]>("percent_off");
  const [newTierValue, setNewTierValue] = useState("");
  const [newTierDesc, setNewTierDesc] = useState("");
  
  useEffect(() => {
    fetchConfig();
  }, [companyId]);
  
  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/loyalty?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setIsEnabled(data.isEnabled ?? true);
        setPointsPerDollar(String(data.pointsPerDollar ?? 1));
        if (data.rewardTiersJson) {
          try {
            setRewardTiers(JSON.parse(data.rewardTiersJson));
          } catch {
            setRewardTiers([]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch loyalty config:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          isEnabled,
          pointsPerDollar: parseFloat(pointsPerDollar) || 1,
          rewardTiers,
        }),
      });
      await fetchConfig();
    } catch (err) {
      console.error("Failed to save loyalty config:", err);
    } finally {
      setSaving(false);
    }
  };
  
  const addTier = () => {
    if (!newTierPoints || !newTierValue) return;
    const tier: RewardTier = {
      points: parseInt(newTierPoints),
      type: newTierType,
      value: parseFloat(newTierValue),
      description: newTierDesc || undefined,
    };
    setRewardTiers([...rewardTiers, tier].sort((a, b) => a.points - b.points));
    setTierModalOpen(false);
    setNewTierPoints("");
    setNewTierType("percent_off");
    setNewTierValue("");
    setNewTierDesc("");
  };
  
  const removeTier = (idx: number) => {
    setRewardTiers(rewardTiers.filter((_, i) => i !== idx));
  };
  
  const getTierTypeLabel = (type: RewardTier["type"]) => {
    switch (type) {
      case "percent_off": return "% Off";
      case "cash_off": return "$ Off";
      case "free_item": return "Free Item";
    }
  };
  
  const getTierIcon = (type: RewardTier["type"]) => {
    switch (type) {
      case "percent_off": return <Percent className="h-4 w-4" />;
      case "cash_off": return <DollarSign className="h-4 w-4" />;
      case "free_item": return <Gift className="h-4 w-4" />;
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
            <h1 className="text-2xl font-bold">Loyalty Program</h1>
            <p className="text-gray-400">Configure customer rewards and points</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <LoadingSpinner size="sm" /> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
          </Button>
        </div>
        
        {/* Info Banner */}
        <div className="p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-200 font-medium">How it works</p>
              <p className="text-blue-200/70 text-sm">Customers earn points on purchases. When they reach a reward tier, they can redeem points for discounts at the POS.</p>
            </div>
          </div>
        </div>
        
        {/* Enable/Disable */}
        <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${isEnabled ? 'bg-rose-600/20' : 'bg-gray-600/20'}`}>
                <Heart className={`h-6 w-6 ${isEnabled ? 'text-rose-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="font-semibold">Loyalty Program Status</h3>
                <p className="text-sm text-gray-400">{isEnabled ? 'Active - customers earn points' : 'Disabled - no points earned'}</p>
              </div>
            </div>
            <button
              onClick={() => setIsEnabled(!isEnabled)}
              className={`w-14 h-7 rounded-full relative transition-colors ${
                isEnabled ? 'bg-rose-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  isEnabled ? 'left-8' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
        
        {/* Points Earning Rate */}
        <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-400" />
            Points Earning Rate
          </h3>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={pointsPerDollar}
              onChange={(e) => setPointsPerDollar(e.target.value)}
              className="w-24 bg-gray-800 border-gray-600"
            />
            <span className="text-gray-400">points per $1 spent</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Example: A $50 purchase earns {Math.floor(50 * (parseFloat(pointsPerDollar) || 1))} points
          </p>
        </div>
        
        {/* Reward Tiers */}
        <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Gift className="h-5 w-5 text-gray-400" />
              Reward Tiers
            </h3>
            <Button size="sm" onClick={() => setTierModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Tier
            </Button>
          </div>
          
          {rewardTiers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Gift className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No reward tiers configured</p>
              <p className="text-sm">Add tiers to give customers rewards for their loyalty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rewardTiers.map((tier, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-rose-600/20 rounded-lg text-rose-400">
                      {getTierIcon(tier.type)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {tier.points.toLocaleString()} points = {tier.type === "percent_off" ? `${tier.value}% off` : tier.type === "cash_off" ? formatCurrency(tier.value) + " off" : `Free item (up to ${formatCurrency(tier.value)})`}
                      </p>
                      {tier.description && (
                        <p className="text-sm text-gray-400">{tier.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTier(idx)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Add Tier Modal */}
      <Modal
        isOpen={tierModalOpen}
        onClose={() => setTierModalOpen(false)}
        title="Add Reward Tier"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Points Required</label>
            <Input
              type="number"
              value={newTierPoints}
              onChange={(e) => setNewTierPoints(e.target.value)}
              placeholder="e.g., 100"
              className="bg-gray-800 border-gray-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Reward Type</label>
            <select
              value={newTierType}
              onChange={(e) => setNewTierType(e.target.value as RewardTier["type"])}
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-white"
            >
              <option value="percent_off">Percentage Off</option>
              <option value="cash_off">Dollar Amount Off</option>
              <option value="free_item">Free Item (up to value)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {newTierType === "percent_off" ? "Discount Percentage" : newTierType === "cash_off" ? "Dollar Amount" : "Max Item Value"}
            </label>
            <Input
              type="number"
              step={newTierType === "percent_off" ? "1" : "0.01"}
              value={newTierValue}
              onChange={(e) => setNewTierValue(e.target.value)}
              placeholder={newTierType === "percent_off" ? "e.g., 10" : "e.g., 5.00"}
              className="bg-gray-800 border-gray-600"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description (Optional)</label>
            <Input
              value={newTierDesc}
              onChange={(e) => setNewTierDesc(e.target.value)}
              placeholder="e.g., Silver Member Reward"
              className="bg-gray-800 border-gray-600"
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setTierModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={addTier} disabled={!newTierPoints || !newTierValue} className="flex-1">
              Add Tier
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
