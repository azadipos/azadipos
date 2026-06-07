"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Percent,
  FileText,
  Printer,
  Download,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";

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
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
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
  cost?: number;
  profit?: number;
  margin?: number;
}

interface TopItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface TaxBreakdownItem {
  rate: number;
  ratePercent: string;
  taxableAmount: number;
  taxCollected: number;
  itemCount: number;
  categoryName: string;
}

const DATE_PRESETS = [
  { label: "Today", getRange: () => { const d = new Date(); const s = d.toISOString().split("T")[0]; return { start: s, end: s }; } },
  { label: "Yesterday", getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = d.toISOString().split("T")[0]; return { start: s, end: s }; } },
  { label: "This Week", getRange: () => { const d = new Date(); const day = d.getDay(); const s = new Date(d); s.setDate(d.getDate() - day); return { start: s.toISOString().split("T")[0], end: d.toISOString().split("T")[0] }; } },
  { label: "Last Week", getRange: () => { const d = new Date(); const day = d.getDay(); const e = new Date(d); e.setDate(d.getDate() - day - 1); const s = new Date(e); s.setDate(e.getDate() - 6); return { start: s.toISOString().split("T")[0], end: e.toISOString().split("T")[0] }; } },
  { label: "This Month", getRange: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0], end: d.toISOString().split("T")[0] }; } },
  { label: "Last Month", getRange: () => { const d = new Date(); const e = new Date(d.getFullYear(), d.getMonth(), 0); const s = new Date(e.getFullYear(), e.getMonth(), 1); return { start: s.toISOString().split("T")[0], end: e.toISOString().split("T")[0] }; } },
  { label: "Last 30 Days", getRange: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate() - 30); return { start: s.toISOString().split("T")[0], end: d.toISOString().split("T")[0] }; } },
  { label: "Last 90 Days", getRange: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate() - 90); return { start: s.toISOString().split("T")[0], end: d.toISOString().split("T")[0] }; } },
  { label: "This Year", getRange: () => { const d = new Date(); return { start: new Date(d.getFullYear(), 0, 1).toISOString().split("T")[0], end: d.toISOString().split("T")[0] }; } },
  { label: "Last Year", getRange: () => { const d = new Date(); return { start: new Date(d.getFullYear() - 1, 0, 1).toISOString().split("T")[0], end: new Date(d.getFullYear() - 1, 11, 31).toISOString().split("T")[0] }; } },
];

export default function ReportsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdownItem[]>([]);

  // Comparison data
  const [comparisonSummary, setComparisonSummary] = useState<Summary | null>(null);
  const [comparisonBreakdown, setComparisonBreakdown] = useState<BreakdownItem[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compLoading, setCompLoading] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [groupBy, setGroupBy] = useState("day");
  const [activeTab, setActiveTab] = useState<"overview" | "breakdown" | "items" | "tax">("overview");
  const [showPresets, setShowPresets] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  // Comparison dates
  const [compStartDate, setCompStartDate] = useState("");
  const [compEndDate, setCompEndDate] = useState("");

  useEffect(() => {
    fetchReport();
  }, [companyId, startDate, endDate, groupBy]);

  useEffect(() => {
    if (compareMode && compStartDate && compEndDate) {
      fetchComparisonReport();
    } else {
      setComparisonSummary(null);
      setComparisonBreakdown([]);
    }
  }, [compareMode, compStartDate, compEndDate, groupBy, companyId]);

  // Close presets on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) setShowPresets(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/reports/sales?companyId=${companyId}&startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      setSummary(data.summary || null);
      setBreakdown(data.breakdown || []);
      setTopItems(data.topItems || []);
      setTaxBreakdown(data.taxBreakdown || []);
    } catch (err: any) {
      console.error("Failed to fetch report:", err);
      setError(err?.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const fetchComparisonReport = async () => {
    setCompLoading(true);
    try {
      const res = await fetch(
        `/api/reports/sales?companyId=${companyId}&startDate=${compStartDate}&endDate=${compEndDate}&groupBy=${groupBy}`
      );
      if (res.ok) {
        const data = await res.json();
        setComparisonSummary(data.summary || null);
        setComparisonBreakdown(data.breakdown || []);
      }
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
    } finally {
      setCompLoading(false);
    }
  };

  const applyPreset = (preset: typeof DATE_PRESETS[0]) => {
    const { start, end } = preset.getRange();
    setStartDate(start);
    setEndDate(end);
    setShowPresets(false);
  };

  const enableComparison = (type: "yoy" | "prev") => {
    setCompareMode(true);
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (type === "yoy") {
      setCompStartDate(new Date(s.getFullYear() - 1, s.getMonth(), s.getDate()).toISOString().split("T")[0]);
      setCompEndDate(new Date(e.getFullYear() - 1, e.getMonth(), e.getDate()).toISOString().split("T")[0]);
    } else {
      const diff = e.getTime() - s.getTime();
      const ps = new Date(s.getTime() - diff - 86400000);
      const pe = new Date(s.getTime() - 86400000);
      setCompStartDate(ps.toISOString().split("T")[0]);
      setCompEndDate(pe.toISOString().split("T")[0]);
    }
  };

  const formatDate = (dateStr: string) => {
    if (groupBy === "month") {
      const [year, month] = dateStr.split("-");
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / Math.abs(previous)) * 100);
  };

  // Merge comparison + primary data for chart
  const chartData = useMemo(() => {
    if (!compareMode) {
      return breakdown.map(b => ({
        label: b.date ? formatDate(b.date) : (b.name || ''),
        sales: Math.round((b.sales || 0) * 100) / 100,
        refunds: Math.round((b.refunds || 0) * 100) / 100,
        net: Math.round((b.net || b.sales - (b.refunds || 0)) * 100) / 100,
      }));
    }
    // Merge by index for comparison
    const max = Math.max(breakdown.length, comparisonBreakdown.length);
    const merged: { label: string; sales: number; compSales: number }[] = [];
    for (let i = 0; i < max; i++) {
      const cur = breakdown[i];
      const comp = comparisonBreakdown[i];
      merged.push({
        label: cur?.date ? formatDate(cur.date) : (comp?.date ? formatDate(comp.date) : `${i + 1}`),
        sales: Math.round((cur?.sales || 0) * 100) / 100,
        compSales: Math.round((comp?.sales || 0) * 100) / 100,
      });
    }
    return merged;
  }, [breakdown, comparisonBreakdown, compareMode, groupBy]);

  const exportCSV = () => {
    const headers = ["Date/Name", "Sales", "Refunds", "Net", "Tax", "Cost", "Profit", "Margin %", "Transactions"];
    const rows = breakdown.map(b => [
      b.date || b.name || '',
      (b.sales || 0).toFixed(2),
      (b.refunds || 0).toFixed(2),
      (b.net || 0).toFixed(2),
      (b.tax || 0).toFixed(2),
      (b.cost || 0).toFixed(2),
      (b.profit || 0).toFixed(2),
      (b.margin || 0).toFixed(1),
      b.count,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const SummaryCard = ({ icon: Icon, label, value, subtext, color, compValue }: {
    icon: any; label: string; value: string; subtext?: string; color: string; compValue?: string;
  }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`p-4 bg-gray-800/50 border border-gray-700 rounded-lg`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 ${color} rounded-lg`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
          {compValue && comparisonSummary && (
            <p className="text-xs text-blue-400 mt-0.5">vs. {compValue}</p>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold">Sales Reports</h1>
            <p className="text-gray-400">Analyze sales performance, trends &amp; comparisons</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700 print:hidden">
          <div className="relative" ref={presetRef}>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowPresets(!showPresets)}>
              <Calendar className="h-4 w-4" /> Quick Range <ChevronDown className="h-3 w-3" />
            </Button>
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]">
                {DATE_PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p)} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-700 text-gray-300 hover:text-white">
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
            <span className="text-gray-400">to</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
          </div>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm">
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="category">By Category</option>
            <option value="employee">By Employee</option>
          </select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => enableComparison("prev")} className={compareMode ? 'border-blue-500 text-blue-400' : ''}>
              vs. Previous Period
            </Button>
            <Button variant="outline" size="sm" onClick={() => enableComparison("yoy")} className={compareMode ? 'border-purple-500 text-purple-400' : ''}>
              vs. Year Ago
            </Button>
            {compareMode && (
              <Button variant="ghost" size="sm" onClick={() => { setCompareMode(false); setComparisonSummary(null); setComparisonBreakdown([]); }}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {compareMode && (
          <div className="flex items-center gap-3 px-4 py-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-sm text-blue-300 print:hidden">
            <span>Comparing:</span>
            <span className="font-medium">{startDate} → {endDate}</span>
            <span>vs.</span>
            <Input type="date" value={compStartDate} onChange={e => setCompStartDate(e.target.value)} className="w-36 h-8 text-xs" />
            <span>to</span>
            <Input type="date" value={compEndDate} onChange={e => setCompEndDate(e.target.value)} className="w-36 h-8 text-xs" />
            {compLoading && <LoadingSpinner size="sm" />}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-600/20 border border-red-600/30 rounded-lg text-red-400">
            <p className="font-medium">Failed to load report</p>
            <p className="text-sm mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchReport}>Retry</Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-700 print:hidden">
          {(["overview", "breakdown", "items", "tax"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}>
              {tab === "overview" ? "Overview" : tab === "breakdown" ? "Breakdown" : tab === "items" ? "Top Items" : "Tax"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
        ) : !error ? (
          <>
            {/* OVERVIEW TAB */}
            {(activeTab === "overview" || typeof window !== 'undefined' && window.matchMedia?.('print')?.matches) && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <SummaryCard icon={DollarSign} label="Total Sales" value={formatCurrency(summary?.totalSales || 0)}
                    subtext={`${summary?.saleCount || 0} transactions`} color="bg-green-600/20 text-green-400"
                    compValue={comparisonSummary ? formatCurrency(comparisonSummary.totalSales) : undefined} />
                  <SummaryCard icon={TrendingDown} label="Refunds" value={`-${formatCurrency(summary?.totalRefunds || 0)}`}
                    subtext={`${summary?.refundCount || 0} refunds`} color="bg-red-600/20 text-red-400"
                    compValue={comparisonSummary ? `-${formatCurrency(comparisonSummary.totalRefunds)}` : undefined} />
                  <SummaryCard icon={TrendingUp} label="Net Sales" value={formatCurrency(summary?.netSales || 0)}
                    color="bg-blue-600/20 text-blue-400"
                    compValue={comparisonSummary ? formatCurrency(comparisonSummary.netSales) : undefined} />
                  <SummaryCard icon={Banknote} label="Cash Sales" value={formatCurrency(summary?.cashSales || 0)}
                    color="bg-emerald-600/20 text-emerald-400" />
                  <SummaryCard icon={CreditCard} label="Card Sales" value={formatCurrency(summary?.cardSales || 0)}
                    color="bg-indigo-600/20 text-indigo-400" />
                  <SummaryCard icon={Percent} label="Profit Margin" value={`${(summary?.profitMargin || 0).toFixed(1)}%`}
                    subtext={`Profit: ${formatCurrency(summary?.grossProfit || 0)}`} color="bg-purple-600/20 text-purple-400" />
                </div>

                {/* Comparison Change Indicators */}
                {comparisonSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Sales", cur: summary?.totalSales || 0, prev: comparisonSummary.totalSales },
                      { label: "Transactions", cur: summary?.saleCount || 0, prev: comparisonSummary.saleCount },
                      { label: "Avg Transaction", cur: summary?.averageTransaction || 0, prev: comparisonSummary.averageTransaction },
                      { label: "Profit", cur: summary?.grossProfit || 0, prev: comparisonSummary.grossProfit },
                    ].map(({ label, cur, prev }) => {
                      const change = pctChange(cur, prev);
                      const isUp = change >= 0;
                      return (
                        <div key={label} className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                          <p className="text-xs text-gray-400">{label} Change</p>
                          <div className="flex items-center gap-2 mt-1">
                            {isUp ? <ArrowUp className="h-4 w-4 text-green-400" /> : <ArrowDown className="h-4 w-4 text-red-400" />}
                            <span className={`text-lg font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{change}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Chart */}
                {chartData.length > 0 && (groupBy === "day" || groupBy === "week" || groupBy === "month") && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <h2 className="text-lg font-semibold mb-4">
                      {compareMode ? 'Sales Comparison' : 'Sales Trend'}
                    </h2>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        {compareMode ? (
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v: number) => formatCurrency(v)} />
                            <Legend />
                            <Bar dataKey="sales" name="Current" fill="#10B981" radius={[4,4,0,0]} />
                            <Bar dataKey="compSales" name="Previous" fill="#6366F1" radius={[4,4,0,0]} />
                          </BarChart>
                        ) : (
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v: number) => formatCurrency(v)} />
                            <Legend />
                            <Bar dataKey="sales" name="Sales" fill="#10B981" radius={[4,4,0,0]} />
                            <Bar dataKey="refunds" name="Refunds" fill="#EF4444" radius={[4,4,0,0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}

                {/* Additional stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-400">Avg Transaction</p>
                    <p className="text-xl font-bold">{formatCurrency(summary?.averageTransaction || 0)}</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-400">Total Tax</p>
                    <p className="text-xl font-bold">{formatCurrency(summary?.totalTax || 0)}</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-400">Total Cost</p>
                    <p className="text-xl font-bold">{formatCurrency(summary?.totalCost || 0)}</p>
                  </div>
                  <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-400">Gross Profit</p>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(summary?.grossProfit || 0)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* BREAKDOWN TAB */}
            {activeTab === "breakdown" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400">
                        <th className="text-left p-3">{groupBy === 'category' || groupBy === 'employee' ? 'Name' : 'Date'}</th>
                        <th className="text-right p-3">Sales</th>
                        <th className="text-right p-3">Refunds</th>
                        <th className="text-right p-3">Net</th>
                        {groupBy !== 'employee' && <th className="text-right p-3">Tax</th>}
                        {groupBy !== 'employee' && <th className="text-right p-3">Profit</th>}
                        {groupBy !== 'employee' && <th className="text-right p-3">Margin</th>}
                        <th className="text-right p-3">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((row, i) => (
                        <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="p-3">{row.date ? formatDate(row.date) : row.name}</td>
                          <td className="p-3 text-right text-green-400">{formatCurrency(row.sales)}</td>
                          <td className="p-3 text-right text-red-400">{formatCurrency(row.refunds || 0)}</td>
                          <td className="p-3 text-right">{formatCurrency(row.net || row.sales - (row.refunds || 0))}</td>
                          {groupBy !== 'employee' && <td className="p-3 text-right text-gray-400">{formatCurrency(row.tax || 0)}</td>}
                          {groupBy !== 'employee' && <td className="p-3 text-right text-blue-400">{formatCurrency(row.profit || 0)}</td>}
                          {groupBy !== 'employee' && <td className="p-3 text-right">{(row.margin || 0).toFixed(1)}%</td>}
                          <td className="p-3 text-right text-gray-400">{row.count}</td>
                        </tr>
                      ))}
                      {breakdown.length === 0 && (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-500">No data for selected period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* TOP ITEMS TAB */}
            {activeTab === "items" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-700">
                    <h2 className="font-semibold flex items-center gap-2"><Package className="h-5 w-5" /> Top Selling Items</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 text-gray-400">
                          <th className="text-left p-3">#</th>
                          <th className="text-left p-3">Item</th>
                          <th className="text-right p-3">Qty Sold</th>
                          <th className="text-right p-3">Revenue</th>
                          <th className="text-right p-3">Cost</th>
                          <th className="text-right p-3">Profit</th>
                          <th className="text-right p-3">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topItems.map((item, i) => (
                          <tr key={item.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="p-3 text-gray-500">{i + 1}</td>
                            <td className="p-3 font-medium">{item.name}</td>
                            <td className="p-3 text-right">{item.quantity}</td>
                            <td className="p-3 text-right text-green-400">{formatCurrency(item.revenue)}</td>
                            <td className="p-3 text-right text-gray-400">{formatCurrency(item.cost)}</td>
                            <td className="p-3 text-right text-blue-400">{formatCurrency(item.profit)}</td>
                            <td className="p-3 text-right">
                              <span className={item.margin > 30 ? 'text-green-400' : item.margin > 15 ? 'text-yellow-400' : 'text-red-400'}>
                                {item.margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {topItems.length === 0 && (
                          <tr><td colSpan={7} className="p-8 text-center text-gray-500">No item data for selected period</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top items chart */}
                {topItems.length > 0 && (
                  <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <h2 className="text-lg font-semibold mb-4">Revenue by Item</h2>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topItems.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                          <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[0,4,4,0]} />
                          <Bar dataKey="profit" name="Profit" fill="#6366F1" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAX TAB */}
            {activeTab === "tax" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h2 className="font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Tax Breakdown</h2>
                  <p className="text-xs text-gray-500 mt-1">For state/local tax reconciliation</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400">
                        <th className="text-left p-3">Category</th>
                        <th className="text-right p-3">Tax Rate</th>
                        <th className="text-right p-3">Taxable Amount</th>
                        <th className="text-right p-3">Tax Collected</th>
                        <th className="text-right p-3">Item Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxBreakdown.map((row, i) => (
                        <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="p-3">{row.categoryName}</td>
                          <td className="p-3 text-right">{row.ratePercent}%</td>
                          <td className="p-3 text-right">{formatCurrency(row.taxableAmount)}</td>
                          <td className="p-3 text-right text-yellow-400">{formatCurrency(row.taxCollected)}</td>
                          <td className="p-3 text-right text-gray-400">{row.itemCount}</td>
                        </tr>
                      ))}
                      {taxBreakdown.length > 0 && (
                        <tr className="font-semibold bg-gray-700/30">
                          <td className="p-3">TOTAL</td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right">{formatCurrency(taxBreakdown.reduce((s, r) => s + r.taxableAmount, 0))}</td>
                          <td className="p-3 text-right text-yellow-400">{formatCurrency(taxBreakdown.reduce((s, r) => s + r.taxCollected, 0))}</td>
                          <td className="p-3 text-right text-gray-400">{taxBreakdown.reduce((s, r) => s + r.itemCount, 0)}</td>
                        </tr>
                      )}
                      {taxBreakdown.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-500">No tax data for selected period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
