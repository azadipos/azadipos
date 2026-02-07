"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Receipt, Calendar, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/helpers";
import { motion, AnimatePresence } from "framer-motion";

interface TransactionItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isWeightItem: boolean;
}

interface Transaction {
  id: string;
  transactionNumber: string;
  type: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashGiven: number | null;
  changeDue: number | null;
  createdAt: string;
  employee: { id: string; name: string } | null;
  items: TransactionItem[];
}

export default function TransactionsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  useEffect(() => {
    fetchTransactions();
  }, [companyId]);
  
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const url = `/api/companies/${companyId}/transactions${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setTransactions(data ?? []);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilter = () => {
    fetchTransactions();
  };
  
  const clearFilter = () => {
    setStartDate("");
    setEndDate("");
    setTimeout(fetchTransactions, 0);
  };
  
  const totals = {
    sales: (transactions ?? []).filter((t) => t?.type === "sale").reduce((sum, t) => sum + (t?.total ?? 0), 0),
    count: (transactions ?? []).filter((t) => t?.type === "sale").length,
  };
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-gray-400 mt-1">View sales history and details</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-end p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
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
          <Button onClick={applyFilter} className="bg-blue-600 hover:bg-blue-700">
            <Filter className="h-4 w-4 mr-2" />
            Apply
          </Button>
          {(startDate || endDate) && (
            <Button variant="outline" onClick={clearFilter} className="border-gray-600 text-gray-300">
              Clear
            </Button>
          )}
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-4 bg-green-600/20 border border-green-600/30 rounded-lg">
            <p className="text-sm text-green-400">Total Sales</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totals.sales)}</p>
          </div>
          <div className="p-4 bg-blue-600/20 border border-blue-600/30 rounded-lg">
            <p className="text-sm text-blue-400">Transactions</p>
            <p className="text-2xl font-bold text-white mt-1">{totals.count}</p>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : (transactions?.length ?? 0) === 0 ? (
          <div className="text-center py-20">
            <Receipt className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No transactions found</h2>
            <p className="text-gray-500 mt-2">Transactions will appear here after sales</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions?.map((txn, index) => (
              <motion.div
                key={txn?.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === txn?.id ? null : txn?.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <p className="font-mono text-gray-400">{txn?.transactionNumber}</p>
                      <p className="text-gray-500 text-xs">{formatDate(txn?.createdAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium">{txn?.employee?.name ?? "Unknown"}</p>
                      <p className="text-sm text-gray-500 capitalize">{txn?.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold">{formatCurrency(txn?.total)}</span>
                    {expandedId === txn?.id ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </button>
                
                <AnimatePresence>
                  {expandedId === txn?.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-700"
                    >
                      <div className="p-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left pb-2">Item</th>
                              <th className="text-right pb-2">Qty</th>
                              <th className="text-right pb-2">Price</th>
                              <th className="text-right pb-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(txn?.items ?? []).map((item) => (
                              <tr key={item?.id} className="border-t border-gray-800">
                                <td className="py-2">{item?.itemName}</td>
                                <td className="py-2 text-right">
                                  {item?.isWeightItem ? `${item?.quantity?.toFixed(2)} lb` : item?.quantity}
                                </td>
                                <td className="py-2 text-right">{formatCurrency(item?.unitPrice)}</td>
                                <td className="py-2 text-right">{formatCurrency(item?.lineTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-gray-700">
                            <tr>
                              <td colSpan={3} className="pt-2 text-right text-gray-400">Subtotal:</td>
                              <td className="pt-2 text-right">{formatCurrency(txn?.subtotal)}</td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="text-right text-gray-400">Tax:</td>
                              <td className="text-right">{formatCurrency(txn?.tax)}</td>
                            </tr>
                            <tr className="font-semibold">
                              <td colSpan={3} className="text-right">Total:</td>
                              <td className="text-right">{formatCurrency(txn?.total)}</td>
                            </tr>
                            {txn?.cashGiven && (
                              <>
                                <tr className="text-gray-400">
                                  <td colSpan={3} className="text-right">Cash Given:</td>
                                  <td className="text-right">{formatCurrency(txn.cashGiven)}</td>
                                </tr>
                                <tr className="text-green-400">
                                  <td colSpan={3} className="text-right">Change Due:</td>
                                  <td className="text-right">{formatCurrency(txn?.changeDue)}</td>
                                </tr>
                              </>
                            )}
                          </tfoot>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}