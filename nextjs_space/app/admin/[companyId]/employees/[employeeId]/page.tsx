"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Modal } from "@/components/modal";
import { formatCurrency } from "@/lib/helpers";
import {
  ArrowLeft,
  User,
  Clock,
  DollarSign,
  Receipt,
  RotateCcw,
  Gift,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  ChevronRight,
  Camera,
  Ban,
  Tag,
  Filter,
  Barcode,
} from "lucide-react";
import { motion } from "framer-motion";

interface Employee {
  id: string;
  name: string;
  barcode: string | null;
  isManager: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface CategorySalesData {
  employeeCategorySales: number;
  employeeCategoryTransactions: number;
  flaggedTransactions: Array<{
    id: string;
    transactionNumber: string;
    total: number;
    categoryTotal: number;
    date: string;
  }>;
  teamComparison: Array<{
    id: string;
    name: string;
    isManager: boolean;
    isCurrentEmployee: boolean;
    categorySales: number;
    categoryItemCount: number;
  }>;
  teamAverage: number;
}

interface Shift {
  id: string;
  startTime: string;
  endTime: string | null;
  openingBalance: number;
  closingBalance: number | null;
  cashInjections: number;
  status: string;
}

interface TransactionSummary {
  totalSales: number;
  totalRefunds: number;
  totalVoids: number;
  totalStoreCredits: number;
  transactionCount: number;
  refundCount: number;
  voidCount: number;
  storeCreditCount: number;
}

interface ShiftDetails {
  shift: Shift & { employee: { name: string } };
  stats: {
    totalSales: number;
    totalRefunds: number;
    totalVoids: number;
    saleCount: number;
    refundCount: number;
    voidCount: number;
    averageTransactionValue: number;
    storeCreditCount: number;
    storeCreditTotal: number;
  };
  sensitiveActions: Array<{
    type: string;
    timestamp: string;
    amount: number;
    details: string;
    transactionId?: string;
  }>;
  hourlyBreakdown: Array<{
    hour: string;
    sales: number;
    refunds: number;
    count: number;
  }>;
}

interface ComparisonData {
  employees: Array<{
    id: string;
    name: string;
    isManager: boolean;
    isCurrentEmployee: boolean;
    totalSales: number;
    saleCount: number;
    totalRefunds: number;
    refundCount: number;
    refundRate: number;
    totalStoreCredits: number;
    storeCreditCount: number;
    storeCreditRate: number;
  }>;
  averages: {
    refundRate: number;
    storeCreditRate: number;
  };
}

export default function EmployeeStatsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const employeeId = params?.employeeId as string;
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState<TransactionSummary | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Shift detail modal
  const [selectedShift, setSelectedShift] = useState<ShiftDetails | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  
  // Comparison modal
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  
  // Category sales tracking
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categorySalesData, setCategorySalesData] = useState<CategorySalesData | null>(null);
  const [categorySalesLoading, setCategorySalesLoading] = useState(false);
  const [categorySalesModalOpen, setCategorySalesModalOpen] = useState(false);
  
  useEffect(() => {
    fetchEmployeeData();
    fetchCategories();
  }, [companyId, employeeId]);
  
  const fetchEmployeeData = async () => {
    try {
      const [empRes, shiftsRes, statsRes, compRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}`),
        fetch(`/api/employees/${employeeId}/shifts`),
        fetch(`/api/employees/${employeeId}/stats`),
        fetch(`/api/employees/${employeeId}/comparison?companyId=${companyId}`),
      ]);
      
      if (empRes.ok) setEmployee(await empRes.json());
      if (shiftsRes.ok) setShifts(await shiftsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (compRes.ok) setComparison(await compRes.json());
    } catch (err) {
      console.error("Failed to fetch employee data:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/categories?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };
  
  const fetchCategorySales = async (categoryId: string) => {
    setCategorySalesLoading(true);
    try {
      const res = await fetch(
        `/api/employees/${employeeId}/category-sales?companyId=${companyId}&categoryId=${categoryId}`
      );
      if (res.ok) {
        const data = await res.json();
        setCategorySalesData(data);
        setCategorySalesModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch category sales:", err);
    } finally {
      setCategorySalesLoading(false);
    }
  };
  
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    if (categoryId) {
      fetchCategorySales(categoryId);
    }
  };
  
  const openShiftDetails = async (shift: Shift) => {
    setShiftLoading(true);
    setShiftModalOpen(true);
    
    try {
      const res = await fetch(`/api/employees/${employeeId}/shifts/${shift.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedShift(data);
      }
    } catch (err) {
      console.error("Failed to fetch shift details:", err);
    } finally {
      setShiftLoading(false);
    }
  };
  
  // Calculate fraud risk indicators
  const currentEmployee = comparison?.employees.find((e) => e.isCurrentEmployee);
  const isHighRefundRate = currentEmployee && comparison?.averages 
    ? currentEmployee.refundRate > comparison.averages.refundRate * 1.5 
    : false;
  const isHighStoreCreditRate = currentEmployee && comparison?.averages 
    ? currentEmployee.storeCreditRate > comparison.averages.storeCreditRate * 1.5 
    : false;
  
  if (loading) {
    return (
      <AdminLayout companyId={companyId}>
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </AdminLayout>
    );
  }
  
  if (!employee) {
    return (
      <AdminLayout companyId={companyId}>
        <div className="text-center py-20">
          <p className="text-gray-400">Employee not found</p>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/admin/${companyId}/employees`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{employee.name}</h1>
            <div className="flex items-center gap-2 text-gray-400">
              <span>{employee.isManager ? "Manager" : "Cashier"}</span>
              <span>•</span>
              <Barcode className="h-4 w-4" />
              <span className="font-mono text-green-400">{employee.barcode || "No barcode"}</span>
            </div>
          </div>
          <Button onClick={() => setComparisonModalOpen(true)} variant="outline">
            <TrendingUp className="h-4 w-4 mr-2" />
            Compare with Team
          </Button>
        </div>
        
        {/* Alert Banner for High Risk */}
        {(isHighRefundRate || isHighStoreCreditRate) && (
          <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-400">Attention Required</h3>
              <p className="text-sm text-gray-300">
                This employee has 
                {isHighRefundRate && " higher than average refund rate"}
                {isHighRefundRate && isHighStoreCreditRate && " and "}
                {isHighStoreCreditRate && " higher than average store credit issuance"}
                . Review shifts below for detailed timestamps.
              </p>
            </div>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="text-xl font-bold">{formatCurrency(stats?.totalSales || 0)}</p>
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
              <div className="p-2 bg-cyan-600/20 rounded-lg">
                <Receipt className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Transactions</p>
                <p className="text-xl font-bold">{stats?.transactionCount || 0}</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`p-4 border rounded-lg ${
              isHighRefundRate
                ? "bg-red-900/30 border-red-700/50"
                : "bg-gray-800/50 border-gray-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isHighRefundRate ? "bg-red-600/30" : "bg-red-600/20"}`}>
                <RotateCcw className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Refunds</p>
                <p className="text-xl font-bold">
                  {stats?.refundCount || 0} ({formatCurrency(Math.abs(stats?.totalRefunds || 0))})
                </p>
                {currentEmployee && (
                  <p className="text-xs text-gray-500">
                    {currentEmployee.refundRate.toFixed(1)}% rate (avg: {comparison?.averages.refundRate.toFixed(1)}%)
                  </p>
                )}
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-4 border rounded-lg ${
              isHighStoreCreditRate
                ? "bg-yellow-900/30 border-yellow-700/50"
                : "bg-gray-800/50 border-gray-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isHighStoreCreditRate ? "bg-yellow-600/30" : "bg-yellow-600/20"}`}>
                <Gift className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Store Credits Issued</p>
                <p className="text-xl font-bold">
                  {stats?.storeCreditCount || 0} ({formatCurrency(stats?.totalStoreCredits || 0)})
                </p>
                {currentEmployee && (
                  <p className="text-xs text-gray-500">
                    {currentEmployee.storeCreditRate.toFixed(1)}% rate (avg: {comparison?.averages.storeCreditRate.toFixed(1)}%)
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Manager Privileges */}
        {employee.isManager && (
          <div className="p-4 bg-purple-900/20 border border-purple-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-purple-400" />
              <h3 className="font-semibold">Manager Privileges</h3>
            </div>
            <p className="text-sm text-gray-400">
              Can authorize refunds, voids, store credits, price modifications, and register operations.
            </p>
          </div>
        )}
        
        {/* Category Sales Tracking */}
        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Filter className="h-5 w-5 text-orange-400" />
                Category Sales Analysis
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Flag transactions containing specific categories for fraud detection
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="flex-1 h-10 px-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <Button
              onClick={() => selectedCategory && fetchCategorySales(selectedCategory)}
              disabled={!selectedCategory || categorySalesLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {categorySalesLoading ? <LoadingSpinner size="sm" /> : "Analyze"}
            </Button>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            <p>
              <strong>Common use cases:</strong> Gift cards (fraud), Tobacco (age-restricted), 
              High-value items (theft), Electronics, etc.
            </p>
          </div>
        </div>
        
        {/* Shift History - Clickable */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Shifts
            </h2>
            <p className="text-sm text-gray-500">Click a shift to view detailed metrics & timestamps</p>
          </div>
          
          {shifts.length === 0 ? (
            <div className="text-center py-8 bg-gray-800/50 rounded-lg border border-gray-700">
              <Clock className="h-12 w-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400">No shift history</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shifts.slice(0, 15).map((shift, index) => (
                <motion.button
                  key={shift.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => openShiftDetails(shift)}
                  className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-colors text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {new Date(shift.startTime).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(shift.startTime).toLocaleTimeString()}
                        {shift.endTime && (
                          <> - {new Date(shift.endTime).toLocaleTimeString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          shift.status === "open"
                            ? "bg-green-600/20 text-green-400"
                            : "bg-gray-600/20 text-gray-400"
                        }`}>
                          {shift.status}
                        </span>
                        <p className="text-sm text-gray-400 mt-1">
                          Opening: {formatCurrency(shift.openingBalance)}
                          {shift.cashInjections > 0 && (
                            <> • +{formatCurrency(shift.cashInjections)}</>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Shift Details Modal */}
      <Modal
        isOpen={shiftModalOpen}
        onClose={() => { setShiftModalOpen(false); setSelectedShift(null); }}
        title="Shift Details"
      >
        {shiftLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : selectedShift ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Shift Summary */}
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">
                    {new Date(selectedShift.shift.startTime).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="font-medium">
                    {new Date(selectedShift.shift.startTime).toLocaleTimeString()}
                    {selectedShift.shift.endTime && (
                      <> - {new Date(selectedShift.shift.endTime).toLocaleTimeString()}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-green-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-400">{formatCurrency(selectedShift.stats.totalSales)}</p>
                <p className="text-xs text-gray-400">{selectedShift.stats.saleCount} Sales</p>
              </div>
              <div className="p-3 bg-red-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-400">{formatCurrency(selectedShift.stats.totalRefunds)}</p>
                <p className="text-xs text-gray-400">{selectedShift.stats.refundCount} Refunds</p>
              </div>
              <div className="p-3 bg-yellow-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-400">{formatCurrency(selectedShift.stats.storeCreditTotal)}</p>
                <p className="text-xs text-gray-400">{selectedShift.stats.storeCreditCount} Credits</p>
              </div>
            </div>
            
            {/* Hourly Breakdown */}
            {selectedShift.hourlyBreakdown.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Hourly Activity
                </h4>
                <div className="space-y-1">
                  {selectedShift.hourlyBreakdown.map((h) => (
                    <div key={h.hour} className="flex items-center gap-2 text-sm">
                      <span className="w-12 text-gray-500">{h.hour}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div 
                          className="h-4 bg-green-600/50 rounded"
                          style={{ width: `${Math.min(100, h.sales / 10)}%` }}
                          title={`Sales: ${formatCurrency(h.sales)}`}
                        />
                        {h.refunds > 0 && (
                          <div 
                            className="h-4 bg-red-600/50 rounded"
                            style={{ width: `${Math.min(50, h.refunds / 5)}%` }}
                            title={`Refunds: ${formatCurrency(h.refunds)}`}
                          />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{h.count} txns</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Sensitive Actions Timeline */}
            {selectedShift.sensitiveActions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-orange-400" />
                  Sensitive Actions (Review with Camera)
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedShift.sensitiveActions.map((action, idx) => (
                    <div 
                      key={idx}
                      className={`p-2 rounded-lg text-sm border ${
                        action.type === "refund" ? "bg-red-900/20 border-red-700/30" :
                        action.type === "void" ? "bg-orange-900/20 border-orange-700/30" :
                        "bg-yellow-900/20 border-yellow-700/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {action.type === "refund" && <RotateCcw className="h-3 w-3 text-red-400" />}
                          {action.type === "void" && <Ban className="h-3 w-3 text-orange-400" />}
                          {action.type === "store_credit" && <Gift className="h-3 w-3 text-yellow-400" />}
                          <span className="uppercase text-xs font-semibold">
                            {action.type.replace("_", " ")}
                          </span>
                        </div>
                        <span className="font-bold">{formatCurrency(action.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                        <span className="font-mono">
                          {new Date(action.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="truncate max-w-[200px]">{action.details}</span>
                      </div>
                      {action.transactionId && (
                        <p className="text-xs text-gray-500 mt-1">TXN: {action.transactionId}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedShift.sensitiveActions.length === 0 && (
              <div className="p-4 bg-green-900/20 border border-green-700/30 rounded-lg text-center">
                <p className="text-green-400 text-sm">No refunds, voids, or store credits during this shift</p>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
      
      {/* Comparison Modal */}
      <Modal
        isOpen={comparisonModalOpen}
        onClose={() => setComparisonModalOpen(false)}
        title="Team Comparison"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="text-sm text-gray-400 mb-4">
            Compare {employee.name}&apos;s metrics with other team members
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">Employee</th>
                  <th className="text-right p-2">Sales</th>
                  <th className="text-right p-2">Refund %</th>
                  <th className="text-right p-2">Credit %</th>
                </tr>
              </thead>
              <tbody>
                {comparison?.employees.map((emp) => (
                  <tr 
                    key={emp.id}
                    className={`border-b border-gray-800 ${
                      emp.isCurrentEmployee ? "bg-blue-900/20" : ""
                    }`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {emp.isCurrentEmployee && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                        <span>{emp.name}</span>
                        {emp.isManager && (
                          <Shield className="h-3 w-3 text-purple-400" />
                        )}
                      </div>
                    </td>
                    <td className="text-right p-2 font-mono">
                      {formatCurrency(emp.totalSales)}
                    </td>
                    <td className="text-right p-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        emp.refundRate > (comparison?.averages.refundRate || 0) * 1.5
                          ? "bg-red-600/30 text-red-400"
                          : "text-gray-400"
                      }`}>
                        {emp.refundRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right p-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        emp.storeCreditRate > (comparison?.averages.storeCreditRate || 0) * 1.5
                          ? "bg-yellow-600/30 text-yellow-400"
                          : "text-gray-400"
                      }`}>
                        {emp.storeCreditRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-800/50">
                  <td className="p-2 font-medium">Team Average</td>
                  <td className="p-2"></td>
                  <td className="text-right p-2 text-gray-400">
                    {comparison?.averages.refundRate.toFixed(1)}%
                  </td>
                  <td className="text-right p-2 text-gray-400">
                    {comparison?.averages.storeCreditRate.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="p-3 bg-gray-800 rounded-lg text-xs text-gray-400">
            <p><strong>Refund %</strong> = Total refunds / Total sales</p>
            <p><strong>Credit %</strong> = Store credits issued / Total transactions × 100</p>
            <p className="mt-2">Employees highlighted in <span className="text-red-400">red</span> or <span className="text-yellow-400">yellow</span> are 50%+ above average.</p>
          </div>
        </div>
      </Modal>
      
      {/* Category Sales Modal */}
      <Modal
        isOpen={categorySalesModalOpen}
        onClose={() => setCategorySalesModalOpen(false)}
        title={`Category Sales Analysis: ${categories.find((c) => c.id === selectedCategory)?.name || ""}`}
      >
        {categorySalesLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : categorySalesData ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-orange-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-400">
                  {formatCurrency(categorySalesData.employeeCategorySales)}
                </p>
                <p className="text-xs text-gray-400">Category Sales</p>
              </div>
              <div className="p-4 bg-orange-900/20 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-400">
                  {categorySalesData.employeeCategoryTransactions}
                </p>
                <p className="text-xs text-gray-400">Transactions with Category</p>
              </div>
            </div>
            
            {/* Team Comparison */}
            {categorySalesData.teamComparison.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Team Comparison
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left p-2">Employee</th>
                        <th className="text-right p-2">Category Sales</th>
                        <th className="text-right p-2">Items Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorySalesData.teamComparison.map((emp) => (
                        <tr 
                          key={emp.id}
                          className={`border-b border-gray-800 ${
                            emp.isCurrentEmployee ? "bg-blue-900/20" : ""
                          }`}
                        >
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {emp.isCurrentEmployee && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                              <span>{emp.name}</span>
                              {emp.isManager && (
                                <Shield className="h-3 w-3 text-purple-400" />
                              )}
                            </div>
                          </td>
                          <td className="text-right p-2 font-mono">
                            {formatCurrency(emp.categorySales)}
                          </td>
                          <td className="text-right p-2">
                            {emp.categoryItemCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-800/50">
                        <td className="p-2 font-medium">Team Average</td>
                        <td className="text-right p-2 text-gray-400">
                          {formatCurrency(categorySalesData.teamAverage)}
                        </td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                {/* Anomaly Detection */}
                {categorySalesData.employeeCategorySales > categorySalesData.teamAverage * 1.5 && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      <span className="text-sm text-red-300">
                        This employee&apos;s category sales are 50%+ above team average
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Flagged Transactions */}
            {categorySalesData.flaggedTransactions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Transactions Containing Category ({categorySalesData.flaggedTransactions.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {categorySalesData.flaggedTransactions.map((txn) => (
                    <div 
                      key={txn.id}
                      className="p-2 bg-gray-800 rounded-lg text-sm flex items-center justify-between"
                    >
                      <div>
                        <p className="font-mono text-xs text-gray-400">{txn.transactionNumber}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(txn.date).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-orange-400 font-medium">
                          {formatCurrency(txn.categoryTotal)}
                          <span className="text-gray-500 text-xs ml-1">in category</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Total: {formatCurrency(txn.total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </AdminLayout>
  );
}
