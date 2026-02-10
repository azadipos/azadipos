"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatCurrency } from "@/lib/helpers";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  Banknote,
  Calendar,
  Users,
  Package,
  Tag,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { motion } from "framer-motion";

interface Summary {
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  netSales: number;
  totalTax: number;
  saleCount: number;
  refundCount: number;
  voidCount: number;
  cashSales: number;
  cardSales: number;
  averageTransaction: number;
}

interface BreakdownItem {
  date?: string;
  name?: string;
  id?: string;
  sales: number;
  refunds?: number;
  count: number;
  tax?: number;
  net?: number;
  quantity?: number;
  refundCount?: number;
}

interface TopItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export default function ReportsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [groupBy, setGroupBy] = useState("day");
  
  useEffect(() => {
    fetchReport();
  }, [companyId, startDate, endDate, groupBy]);
  
  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/sales?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`
      );
      const data = await res.json();
      setSummary(data.summary);
      setBreakdown(data.breakdown || []);
      setTopItems(data.topItems || []);
    } catch (err) {
      console.error("Failed to fetch report:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    if (groupBy === "month") {
      const [year, month] = dateStr.split("-");
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Reports</h1>
            <p className="text-gray-400">Analyze sales performance and trends</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Group by:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="category">Category</option>
              <option value="employee">Employee</option>
            </select>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-600/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Total Sales</p>
                    <p className="text-xl font-bold text-green-400">
                      {formatCurrency(summary?.totalSales || 0)}
                    </p>
                    <p className="text-xs text-gray-500">{summary?.saleCount || 0} transactions</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-600/20 rounded-lg">
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Refunds</p>
                    <p className="text-xl font-bold text-red-400">
                      -{formatCurrency(summary?.totalRefunds || 0)}
                    </p>
                    <p className="text-xs text-gray-500">{summary?.refundCount || 0} refunds</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Net Sales</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(summary?.netSales || 0)}
                    </p>
                    <p className="text-xs text-gray-500">Tax: {formatCurrency(summary?.totalTax || 0)}</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Receipt className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Avg Transaction</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(summary?.averageTransaction || 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Cash: {formatCurrency(summary?.cashSales || 0)} | Card: {formatCurrency(summary?.cardSales || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Payment Method Breakdown */}
            <div className="grid lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  Payment Methods
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-green-400" />
                      <span>Cash</span>
                    </div>
                    <span className="font-medium">{formatCurrency(summary?.cashSales || 0)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${summary?.totalSales ? (summary.cashSales / summary.totalSales) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-400" />
                      <span>Card</span>
                    </div>
                    <span className="font-medium">{formatCurrency(summary?.cardSales || 0)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${summary?.totalSales ? (summary.cardSales / summary.totalSales) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </motion.div>
              
              {/* Top Selling Items */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
              >
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-gray-400" />
                  Top Selling Items
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {topItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No sales data</p>
                  ) : (
                    topItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-700/30 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-5">#{idx + 1}</span>
                          <span className="text-sm truncate max-w-[180px]">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatCurrency(item.revenue)}</p>
                          <p className="text-xs text-gray-500">{item.quantity} sold</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
            
            {/* Breakdown Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
            >
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                {groupBy === "category" ? <Tag className="h-5 w-5" /> :
                 groupBy === "employee" ? <Users className="h-5 w-5" /> :
                 <BarChart3 className="h-5 w-5" />}
                {groupBy === "category" ? "Sales by Category" :
                 groupBy === "employee" ? "Sales by Employee" :
                 "Sales Over Time"}
              </h3>
              
              {breakdown.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No data for selected period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                        <th className="pb-3">
                          {groupBy === "category" || groupBy === "employee" ? "Name" : "Date"}
                        </th>
                        <th className="pb-3 text-right">Sales</th>
                        {(groupBy === "day" || groupBy === "week" || groupBy === "month" || groupBy === "employee") && (
                          <th className="pb-3 text-right">Refunds</th>
                        )}
                        {groupBy === "category" && (
                          <th className="pb-3 text-right">Items Sold</th>
                        )}
                        <th className="pb-3 text-right">
                          {groupBy === "category" ? "Transactions" : "Net"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                          <td className="py-3">
                            {row.date ? formatDate(row.date) : row.name}
                          </td>
                          <td className="py-3 text-right text-green-400">
                            {formatCurrency(row.sales)}
                          </td>
                          {(groupBy === "day" || groupBy === "week" || groupBy === "month" || groupBy === "employee") && (
                            <td className="py-3 text-right text-red-400">
                              -{formatCurrency(row.refunds || 0)}
                            </td>
                          )}
                          {groupBy === "category" && (
                            <td className="py-3 text-right">
                              {row.quantity?.toFixed(0)}
                            </td>
                          )}
                          <td className="py-3 text-right font-medium">
                            {groupBy === "category" 
                              ? row.count 
                              : formatCurrency(row.net || row.sales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
