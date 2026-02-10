"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Package, Users, Receipt, Tags, Truck, TrendingUp, Gift, ClipboardList, DollarSign, BarChart3, AlertTriangle, ShieldCheck, FileText, Heart, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

interface Company {
  id: string;
  name: string;
  _count: {
    items: number;
    employees: number;
    transactions: number;
  };
}

export default function CompanyDashboard() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (companyId) {
      fetchCompany();
    }
  }, [companyId]);
  
  const fetchCompany = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      const data = await res.json();
      setCompany(data);
    } catch (err) {
      console.error("Failed to fetch company:", err);
    } finally {
      setLoading(false);
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
  
  const menuItems = [
    {
      label: "Inventory",
      icon: Package,
      href: `/admin/${companyId}/inventory`,
      color: "bg-blue-600/20 text-blue-400",
      count: company?._count?.items ?? 0,
      description: "Manage products",
    },
    {
      label: "Categories",
      icon: Tags,
      href: `/admin/${companyId}/categories`,
      color: "bg-purple-600/20 text-purple-400",
      description: "Organize items",
    },
    {
      label: "Vendors",
      icon: Truck,
      href: `/admin/${companyId}/vendors`,
      color: "bg-orange-600/20 text-orange-400",
      description: "Supplier info",
    },
    {
      label: "Employees",
      icon: Users,
      href: `/admin/${companyId}/employees`,
      color: "bg-green-600/20 text-green-400",
      count: company?._count?.employees ?? 0,
      description: "Staff & activity",
    },
    {
      label: "Transactions",
      icon: Receipt,
      href: `/admin/${companyId}/transactions`,
      color: "bg-cyan-600/20 text-cyan-400",
      count: company?._count?.transactions ?? 0,
      description: "Sales history",
    },
    {
      label: "Promotions",
      icon: Gift,
      href: `/admin/${companyId}/promotions`,
      color: "bg-pink-600/20 text-pink-400",
      description: "BOGO, sales, deals",
    },
    {
      label: "Reorder",
      icon: AlertTriangle,
      href: `/admin/${companyId}/reorder`,
      color: "bg-amber-600/20 text-amber-400",
      description: "Low stock alerts",
    },
    {
      label: "Receiving",
      icon: ClipboardList,
      href: `/admin/${companyId}/receiving`,
      color: "bg-yellow-600/20 text-yellow-400",
      description: "Inventory intake",
    },
    {
      label: "Payouts",
      icon: DollarSign,
      href: `/admin/${companyId}/payouts`,
      color: "bg-red-600/20 text-red-400",
      description: "Vendor payments",
    },
    {
      label: "Sales Reports",
      icon: BarChart3,
      href: `/admin/${companyId}/reports`,
      color: "bg-emerald-600/20 text-emerald-400",
      description: "Analytics & breakdown",
    },
    {
      label: "Policies",
      icon: ShieldCheck,
      href: `/admin/${companyId}/policies`,
      color: "bg-slate-600/20 text-slate-400",
      description: "Return rules & limits",
    },
    {
      label: "Audit Trail",
      icon: FileText,
      href: `/admin/${companyId}/audit-trail`,
      color: "bg-zinc-600/20 text-zinc-400",
      description: "Action history log",
    },
    {
      label: "Loyalty Program",
      icon: Heart,
      href: `/admin/${companyId}/loyalty`,
      color: "bg-rose-600/20 text-rose-400",
      description: "Rewards & points",
    },
    {
      label: "Gift Cards",
      icon: CreditCard,
      href: `/admin/${companyId}/gift-cards`,
      color: "bg-indigo-600/20 text-indigo-400",
      description: "Manage gift cards",
    },
  ];
  
  return (
    <AdminLayout companyId={companyId} companyName={company?.name}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{company?.name ?? "Dashboard"}</h1>
          <p className="text-gray-400 mt-1">Manage your business operations</p>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <button
                  onClick={() => router.push(item.href)}
                  className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-all text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${item.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    {item.count !== undefined && (
                      <span className="text-2xl font-bold text-gray-300">{item.count}</span>
                    )}
                  </div>
                  <h3 className="mt-4 font-semibold text-lg">{item.label}</h3>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </button>
              </motion.div>
            );
          })}
        </div>
        
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            <div>
              <h3 className="font-semibold">Quick Stats</h3>
              <p className="text-sm text-gray-400">
                {company?._count?.items ?? 0} items • {company?._count?.employees ?? 0} employees • {company?._count?.transactions ?? 0} transactions
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}