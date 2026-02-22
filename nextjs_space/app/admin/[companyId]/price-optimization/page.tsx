"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatCurrency } from "@/lib/helpers";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Percent,
  Package,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

interface Item {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost: number;
  category: { name: string } | null;
}

interface PricePoint {
  price: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  transactionCount: number;
  profitMargin: number;
  avgQuantityPerDay: number;
  profitPerUnit: number;
  dates: { start: string; end: string } | null;
}

interface ElasticityData {
  fromPrice: number;
  toPrice: number;
  elasticity: number;
  interpretation: string;
}

interface ItemAnalysis {
  item: Item;
  pricePoints: PricePoint[];
  elasticityData: ElasticityData[];
  optimalPricePoint: PricePoint;
  summary: {
    totalTransactions: number;
    totalQuantitySold: number;
    totalRevenue: number;
    currentPrice: number;
    currentCost: number;
    pricePointCount: number;
  };
}

export default function PriceOptimizationPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [analysis, setAnalysis] = useState<ItemAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  useEffect(() => {
    fetchItems();
  }, [companyId]);
  
  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/price-optimization?companyId=${companyId}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAnalysis = async (itemId: string) => {
    setAnalysisLoading(true);
    try {
      const params = new URLSearchParams({ companyId, itemId });
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const res = await fetch(`/api/price-optimization?${params}`);
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error("Failed to fetch analysis:", err);
    } finally {
      setAnalysisLoading(false);
    }
  };
  
  const selectItem = (item: Item) => {
    setSelectedItem(item);
    fetchAnalysis(item.id);
  };
  
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.barcode.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);
  
  const reanalyze = () => {
    if (selectedItem) {
      fetchAnalysis(selectedItem.id);
    }
  };
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-green-400" />
            Price Optimization
          </h1>
          <p className="text-gray-400 mt-1">
            Analyze sales performance at different price points to optimize profitability
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Item List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-600 text-white"
              />
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg max-h-[calc(100vh-280px)] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No items found
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {filteredItems.slice(0, 100).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors ${
                        selectedItem?.id === item.id ? "bg-green-900/30 border-l-2 border-green-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-400">{item.barcode}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-400">{formatCurrency(item.price)}</p>
                          <p className="text-xs text-gray-500">Cost: {formatCurrency(item.cost)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Analysis Panel */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedItem ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                <Target className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-400">Select an Item</h3>
                <p className="text-gray-500 mt-2">
                  Choose an item from the list to analyze its price performance
                </p>
              </div>
            ) : (
              <>
                {/* Date Filter */}
                <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white w-40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white w-40"
                    />
                  </div>
                  <Button onClick={reanalyze} className="bg-green-600 hover:bg-green-700">
                    <Calendar className="h-4 w-4 mr-2" />
                    Analyze Period
                  </Button>
                </div>
                
                {analysisLoading ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : analysis ? (
                  <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Package className="h-4 w-4" />
                          <span className="text-sm">Total Sold</span>
                        </div>
                        <p className="text-2xl font-bold">{analysis.summary.totalQuantitySold.toFixed(1)}</p>
                      </div>
                      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm">Total Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-green-400">{formatCurrency(analysis.summary.totalRevenue)}</p>
                      </div>
                      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <BarChart3 className="h-4 w-4" />
                          <span className="text-sm">Price Points</span>
                        </div>
                        <p className="text-2xl font-bold">{analysis.summary.pricePointCount}</p>
                      </div>
                      <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Target className="h-4 w-4" />
                          <span className="text-sm">Optimal Price</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-400">
                          {analysis.optimalPricePoint ? formatCurrency(analysis.optimalPricePoint.price) : "-"}
                        </p>
                      </div>
                    </div>
                    
                    {/* Price Points Analysis */}
                    {analysis.pricePoints.length === 0 ? (
                      <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-lg text-center">
                        <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No sales data found for this period</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Try expanding the date range or this item may not have any transactions yet.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-700">
                          <h3 className="font-semibold flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-400" />
                            Price Point Performance
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-800">
                              <tr>
                                <th className="text-left p-3 text-sm text-gray-400">Price</th>
                                <th className="text-right p-3 text-sm text-gray-400">Qty Sold</th>
                                <th className="text-right p-3 text-sm text-gray-400">Revenue</th>
                                <th className="text-right p-3 text-sm text-gray-400">Profit</th>
                                <th className="text-right p-3 text-sm text-gray-400">Margin</th>
                                <th className="text-right p-3 text-sm text-gray-400">$/Unit</th>
                                <th className="text-right p-3 text-sm text-gray-400">Avg/Day</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                              {analysis.pricePoints.map((pp, idx) => {
                                const isOptimal = analysis.optimalPricePoint?.price === pp.price;
                                return (
                                  <tr
                                    key={idx}
                                    className={`hover:bg-gray-700/50 ${
                                      isOptimal ? "bg-green-900/20" : ""
                                    }`}
                                  >
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{formatCurrency(pp.price)}</span>
                                        {isOptimal && (
                                          <span className="px-1.5 py-0.5 bg-green-600/30 text-green-400 text-xs rounded">
                                            OPTIMAL
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3 text-right">{pp.totalQuantity.toFixed(1)}</td>
                                    <td className="p-3 text-right">{formatCurrency(pp.totalRevenue)}</td>
                                    <td className="p-3 text-right">
                                      <span className={pp.totalProfit >= 0 ? "text-green-400" : "text-red-400"}>
                                        {formatCurrency(pp.totalProfit)}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      <span className={pp.profitMargin >= 20 ? "text-green-400" : pp.profitMargin >= 10 ? "text-amber-400" : "text-red-400"}>
                                        {pp.profitMargin.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">{formatCurrency(pp.profitPerUnit)}</td>
                                    <td className="p-3 text-right">{pp.avgQuantityPerDay.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {/* Elasticity Analysis */}
                    {analysis.elasticityData.length > 0 && (
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-gray-700">
                          <h3 className="font-semibold flex items-center gap-2">
                            <Percent className="h-5 w-5 text-blue-400" />
                            Price Elasticity Analysis
                          </h3>
                          <p className="text-sm text-gray-400 mt-1">
                            Shows how quantity demanded changes with price changes
                          </p>
                        </div>
                        <div className="divide-y divide-gray-700">
                          {analysis.elasticityData.map((ed, idx) => (
                            <div key={idx} className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="font-medium">{formatCurrency(ed.fromPrice)}</p>
                                  <p className="text-xs text-gray-500">Higher</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-500" />
                                <div>
                                  <p className="font-medium">{formatCurrency(ed.toPrice)}</p>
                                  <p className="text-xs text-gray-500">Lower</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-medium ${
                                  Math.abs(ed.elasticity) > 1 ? "text-amber-400" : "text-green-400"
                                }`}>
                                  {ed.elasticity.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-400">{ed.interpretation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-4 bg-gray-800 text-sm text-gray-400">
                          <p><strong>Elastic (&gt;1):</strong> Customers are price-sensitive. Lower prices may increase total revenue.</p>
                          <p className="mt-1"><strong>Inelastic (&lt;1):</strong> Customers are less price-sensitive. Higher prices may increase total revenue.</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Recommendation */}
                    {analysis.optimalPricePoint && analysis.pricePoints.length > 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-lg"
                      >
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Target className="h-5 w-5 text-green-400" />
                          Recommendation
                        </h3>
                        <p className="text-gray-300 mt-2">
                          Based on historical sales data, the optimal price point for <strong>{analysis.item.name}</strong> is{" "}
                          <span className="text-green-400 font-bold">{formatCurrency(analysis.optimalPricePoint.price)}</span>,
                          which generated the highest total profit of{" "}
                          <span className="text-green-400 font-bold">{formatCurrency(analysis.optimalPricePoint.totalProfit)}</span>.
                        </p>
                        {analysis.optimalPricePoint.price !== analysis.summary.currentPrice && (
                          <p className="text-amber-400 mt-2 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Current price ({formatCurrency(analysis.summary.currentPrice)}) differs from optimal.
                            Consider adjusting.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
