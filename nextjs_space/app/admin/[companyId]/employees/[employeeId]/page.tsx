"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
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
} from "lucide-react";
import { motion } from "framer-motion";

interface Employee {
  id: string;
  name: string;
  pin: string;
  isManager: boolean;
  isActive: boolean;
  createdAt: string;
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

export default function EmployeeStatsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const employeeId = params?.employeeId as string;
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchEmployeeData();
  }, [companyId, employeeId]);
  
  const fetchEmployeeData = async () => {
    try {
      // Fetch employee details
      const empRes = await fetch(`/api/employees/${employeeId}`);
      if (empRes.ok) {
        const emp = await empRes.json();
        setEmployee(emp);
      }
      
      // Fetch shifts
      const shiftsRes = await fetch(`/api/employees/${employeeId}/shifts`);
      if (shiftsRes.ok) {
        const shiftsData = await shiftsRes.json();
        setShifts(shiftsData);
      }
      
      // Fetch transaction stats
      const statsRes = await fetch(`/api/employees/${employeeId}/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error("Failed to fetch employee data:", err);
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
          <div>
            <h1 className="text-2xl font-bold">{employee.name}</h1>
            <p className="text-gray-400">
              {employee.isManager ? "Manager" : "Cashier"} • PIN: {employee.pin}
            </p>
          </div>
        </div>
        
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
            className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600/20 rounded-lg">
                <RotateCcw className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Refunds</p>
                <p className="text-xl font-bold">
                  {stats?.refundCount || 0} ({formatCurrency(Math.abs(stats?.totalRefunds || 0))})
                </p>
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
              <div className="p-2 bg-yellow-600/20 rounded-lg">
                <Gift className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Store Credits Issued</p>
                <p className="text-xl font-bold">
                  {stats?.storeCreditCount || 0} ({formatCurrency(stats?.totalStoreCredits || 0)})
                </p>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Manager Authorizations (if manager) */}
        {employee.isManager && (
          <div className="p-4 bg-purple-900/20 border border-purple-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-purple-400" />
              <h3 className="font-semibold">Manager Privileges</h3>
            </div>
            <p className="text-sm text-gray-400">
              This employee can authorize refunds, voids, store credits, price modifications,
              and register operations.
            </p>
          </div>
        )}
        
        {/* Shift History */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Shifts
          </h2>
          
          {shifts.length === 0 ? (
            <div className="text-center py-8 bg-gray-800/50 rounded-lg border border-gray-700">
              <Clock className="h-12 w-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400">No shift history</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shifts.slice(0, 10).map((shift, index) => (
                <motion.div
                  key={shift.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
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
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
