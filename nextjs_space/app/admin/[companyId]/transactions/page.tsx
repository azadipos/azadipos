"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Receipt, Calendar, ChevronDown, ChevronUp, Filter, RotateCcw, DollarSign, XCircle, Trash2, AlertTriangle } from "lucide-react";
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
  status: string;
  createdAt: string;
  employee: { id: string; name: string } | null;
  authorizedBy: { id: string; name: string } | null;
  items: TransactionItem[];
}

const TRANSACTION_TYPES = [
  { value: "all", label: "All Types", color: "bg-gray-600/20 text-gray-400" },
  { value: "sale", label: "Sales", color: "bg-green-600/20 text-green-400" },
  { value: "refund", label: "Refunds", color: "bg-red-600/20 text-red-400" },
  { value: "void", label: "Voids", color: "bg-orange-600/20 text-orange-400" },
];

export default function TransactionsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Delete transaction state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  
  useEffect(() => {
    fetchTransactions();
  }, [companyId]);
  
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);
      if (typeFilter && typeFilter !== "all") queryParams.append("type", typeFilter);
      
      const url = `/api/companies/${companyId}/transactions${queryParams.toString() ? `?${queryParams}` : ""}`;
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
    setTypeFilter("all");
    setTimeout(fetchTransactions, 0);
  };
  
  const openDeleteModal = (txn: Transaction) => {
    setTransactionToDelete(txn);
    setDeleteReason("");
    setDeleteError("");
    setDeleteModalOpen(true);
  };
  
  const handleDelete = async () => {
    if (!transactionToDelete) return;
    
    setDeleting(true);
    setDeleteError("");
    
    try {
      // Admin delete - no manager authorization required, no inventory impact
      const reason = encodeURIComponent(deleteReason || "Deleted by admin");
      const deleteRes = await fetch(
        `/api/transactions/${transactionToDelete.id}?reason=${reason}&source=admin`,
        { method: "DELETE" }
      );
      
      if (!deleteRes.ok) {
        throw new Error("Failed to delete transaction");
      }
      
      // Refresh transactions
      await fetchTransactions();
      setDeleteModalOpen(false);
      setTransactionToDelete(null);
      setDeleteReason("");
    } catch (err) {
      console.error("Delete error:", err);
      setDeleteError("Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  };
  
  // Filter transactions by type for display (in case API doesn't filter)
  const filteredTransactions = typeFilter === "all" 
    ? transactions 
    : transactions.filter((t) => t?.type === typeFilter);
  
  const totals = {
    sales: (transactions ?? []).filter((t) => t?.type === "sale" && t?.status !== "deleted").reduce((sum, t) => sum + (t?.total ?? 0), 0),
    salesCount: (transactions ?? []).filter((t) => t?.type === "sale" && t?.status !== "deleted").length,
    refunds: (transactions ?? []).filter((t) => t?.type === "refund").reduce((sum, t) => sum + Math.abs(t?.total ?? 0), 0),
    refundsCount: (transactions ?? []).filter((t) => t?.type === "refund").length,
    voids: (transactions ?? []).filter((t) => t?.type === "void" || t?.status === "deleted").length,
  };
  
  const getTypeColor = (type: string, status?: string) => {
    if (status === "deleted") return "text-gray-500";
    switch (type) {
      case "sale": return "text-green-400";
      case "refund": return "text-red-400";
      case "void": return "text-orange-400";
      default: return "text-gray-400";
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sale": return <DollarSign className="h-4 w-4" />;
      case "refund": return <RotateCcw className="h-4 w-4" />;
      case "void": return <XCircle className="h-4 w-4" />;
      default: return <Receipt className="h-4 w-4" />;
    }
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
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 px-3 bg-gray-800 border border-gray-600 text-white rounded-lg w-36"
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={applyFilter} className="bg-blue-600 hover:bg-blue-700">
            <Filter className="h-4 w-4 mr-2" />
            Apply
          </Button>
          {(startDate || endDate || typeFilter !== "all") && (
            <Button variant="outline" onClick={clearFilter} className="border-gray-600 text-gray-300">
              Clear
            </Button>
          )}
        </div>
        
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 bg-green-600/20 border border-green-600/30 rounded-lg">
            <p className="text-sm text-green-400">Total Sales</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totals.sales)}</p>
            <p className="text-xs text-gray-500 mt-1">{totals.salesCount} transactions</p>
          </div>
          <div className="p-4 bg-red-600/20 border border-red-600/30 rounded-lg">
            <p className="text-sm text-red-400">Total Refunds</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totals.refunds)}</p>
            <p className="text-xs text-gray-500 mt-1">{totals.refundsCount} refunds</p>
          </div>
          <div className="p-4 bg-orange-600/20 border border-orange-600/30 rounded-lg">
            <p className="text-sm text-orange-400">Voids</p>
            <p className="text-2xl font-bold text-white mt-1">{totals.voids}</p>
            <p className="text-xs text-gray-500 mt-1">voided transactions</p>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : (filteredTransactions?.length ?? 0) === 0 ? (
          <div className="text-center py-20">
            <Receipt className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No transactions found</h2>
            <p className="text-gray-500 mt-2">
              {typeFilter !== "all" 
                ? `No ${typeFilter} transactions match your criteria` 
                : "Transactions will appear here after sales"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions?.map((txn, index) => (
              <motion.div
                key={txn?.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className={`bg-gray-800/50 border rounded-lg overflow-hidden ${
                  txn?.status === "deleted" ? "border-gray-700/50 opacity-60" : "border-gray-700"
                }`}
              >
                <button
                  onClick={() => setExpandedId(expandedId === txn?.id ? null : txn?.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      txn?.status === "deleted" ? "bg-gray-700/50" :
                      txn?.type === "sale" ? "bg-green-600/20" :
                      txn?.type === "refund" ? "bg-red-600/20" :
                      "bg-orange-600/20"
                    }`}>
                      <span className={getTypeColor(txn?.type, txn?.status)}>{getTypeIcon(txn?.type)}</span>
                    </div>
                    <div className="text-sm">
                      <p className="font-mono text-gray-400">{txn?.transactionNumber}</p>
                      <p className="text-gray-500 text-xs">{formatDate(txn?.createdAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium">{txn?.employee?.name ?? "Unknown"}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs uppercase font-medium ${getTypeColor(txn?.type, txn?.status)}`}>
                          {txn?.status === "deleted" ? "VOIDED" : txn?.type}
                        </span>
                        <span className="text-sm text-gray-500 capitalize">• {txn?.paymentMethod}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {txn?.status !== "deleted" && txn?.type === "sale" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(txn);
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <span className={`text-lg font-semibold ${
                      txn?.status === "deleted" ? "text-gray-500 line-through" :
                      txn?.type === "refund" ? "text-red-400" : 
                      txn?.type === "void" ? "text-orange-400" : ""
                    }`}>
                      {txn?.type === "refund" ? "-" : ""}{formatCurrency(Math.abs(txn?.total ?? 0))}
                    </span>
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
                        {txn?.status === "deleted" && txn?.authorizedBy && (
                          <div className="mb-4 p-3 bg-orange-900/30 border border-orange-700/50 rounded-lg text-sm">
                            <p className="text-orange-400">Voided by: {txn.authorizedBy.name}</p>
                          </div>
                        )}
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
      
      {/* Delete Transaction Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setTransactionToDelete(null);
          setDeleteReason("");
          setDeleteError("");
        }}
        title="Delete Transaction"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-900/30 border border-amber-700/50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 font-medium">Admin Delete</p>
                <p className="text-amber-200/70 text-sm">This marks the transaction as deleted for audit purposes. Inventory will NOT be affected.</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Transaction</p>
            <p className="font-mono">{transactionToDelete?.transactionNumber}</p>
            <p className="text-lg font-bold text-green-400 mt-2">{formatCurrency(transactionToDelete?.total ?? 0)}</p>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Reason for deletion (optional)</label>
            <Input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g., Test transaction, Duplicate entry"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          
          {deleteError && (
            <p className="text-red-400 text-sm text-center">{deleteError}</p>
          )}
          
          <div className="flex gap-4 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300"
              onClick={() => {
                setDeleteModalOpen(false);
                setTransactionToDelete(null);
                setDeleteReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <LoadingSpinner size="sm" /> : "Delete Transaction"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
