"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ClipboardList, Calendar, Trash2, Filter, AlertTriangle, ChevronLeft, ChevronRight, FileText, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import { formatCurrency } from "@/lib/helpers";
import { motion } from "framer-motion";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  employeeId: string | null;
  employeeName: string | null;
  authorizedById: string | null;
  authorizedByName: string | null;
  metadata: string | null;
  createdAt: string;
}

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "DELETE_TRANSACTION", label: "Transaction Deletes" },
  { value: "VOID", label: "Voids" },
  { value: "REFUND", label: "Refunds" },
  { value: "STORE_CREDIT_ISSUED", label: "Store Credits" },
  { value: "SHIFT_CLOSED", label: "Shift Closings" },
];

const getActionColor = (action: string) => {
  switch (action) {
    case "DELETE_TRANSACTION": return "bg-red-600/20 text-red-400";
    case "VOID": return "bg-orange-600/20 text-orange-400";
    case "REFUND": return "bg-amber-600/20 text-amber-400";
    case "STORE_CREDIT_ISSUED": return "bg-purple-600/20 text-purple-400";
    case "SHIFT_CLOSED": return "bg-blue-600/20 text-blue-400";
    default: return "bg-gray-600/20 text-gray-400";
  }
};

export default function AuditTrailPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  
  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [entryToDelete, setEntryToDelete] = useState<AuditEntry | null>(null);
  const [bulkDeleteDate, setBulkDeleteDate] = useState("");
  const [deleting, setDeleting] = useState(false);
  
  const pageSize = 50;
  
  useEffect(() => {
    fetchAuditTrail();
  }, [companyId, page]);
  
  const fetchAuditTrail = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId,
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      const res = await fetch(`/api/audit-trail?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch audit trail:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilter = () => {
    setPage(0);
    fetchAuditTrail();
  };
  
  const clearFilter = () => {
    setStartDate("");
    setEndDate("");
    setActionFilter("all");
    setPage(0);
    setTimeout(fetchAuditTrail, 0);
  };
  
  const openSingleDelete = (entry: AuditEntry) => {
    setEntryToDelete(entry);
    setDeleteMode("single");
    setDeleteModalOpen(true);
  };
  
  const openBulkDelete = () => {
    setDeleteMode("bulk");
    setBulkDeleteDate("");
    setDeleteModalOpen(true);
  };
  
  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (deleteMode === "single" && entryToDelete) {
        await fetch(`/api/audit-trail?companyId=${companyId}&id=${entryToDelete.id}`, {
          method: "DELETE",
        });
      } else if (deleteMode === "bulk" && bulkDeleteDate) {
        await fetch(`/api/audit-trail?companyId=${companyId}&beforeDate=${bulkDeleteDate}`, {
          method: "DELETE",
        });
      }
      setDeleteModalOpen(false);
      setEntryToDelete(null);
      fetchAuditTrail();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(false);
    }
  };
  
  const parseMetadata = (metadata: string | null): Record<string, any> => {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };
  
  const totalPages = Math.ceil(total / pageSize);
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Trail</h1>
            <p className="text-gray-400">Track all sensitive actions</p>
          </div>
          <Button variant="outline" onClick={openBulkDelete} className="border-red-600/50 text-red-400 hover:bg-red-600/20">
            <Trash2 className="h-4 w-4 mr-2" />
            Bulk Delete
          </Button>
        </div>
        
        {/* Filters */}
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
            <label className="block text-sm text-gray-400 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-10 px-3 bg-gray-800 border border-gray-600 text-white rounded-lg w-48"
            >
              {ACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={applyFilter} className="bg-blue-600 hover:bg-blue-700">
            <Filter className="h-4 w-4 mr-2" />
            Apply
          </Button>
          {(startDate || endDate || actionFilter !== "all") && (
            <Button variant="outline" onClick={clearFilter} className="border-gray-600 text-gray-300">
              Clear
            </Button>
          )}
        </div>
        
        {/* Summary */}
        <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <ClipboardList className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-gray-400">{total} audit entries</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchAuditTrail}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Entries */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No audit entries found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => {
              const meta = parseMetadata(entry.metadata);
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                          {entry.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-200">{entry.description}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                        {entry.employeeName && (
                          <span>Employee: {entry.employeeName}</span>
                        )}
                        {entry.authorizedByName && (
                          <span>Authorized by: {entry.authorizedByName}</span>
                        )}
                        {meta.total !== undefined && (
                          <span>Amount: {formatCurrency(meta.total)}</span>
                        )}
                        {entry.entityId && (
                          <span className="font-mono text-xs">ID: {entry.entityId.slice(0, 8)}...</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSingleDelete(entry)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border-gray-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-gray-400">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="border-gray-600"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setEntryToDelete(null);
        }}
        title={deleteMode === "single" ? "Delete Audit Entry" : "Bulk Delete Audit Entries"}
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 font-medium">This cannot be undone</p>
                <p className="text-red-200/70 text-sm">
                  {deleteMode === "single"
                    ? "This audit entry will be permanently deleted."
                    : "All entries before the selected date will be permanently deleted."}
                </p>
              </div>
            </div>
          </div>
          
          {/* Legal Compliance Disclaimer */}
          <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Scale className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-200 font-medium">Legal Compliance Notice</p>
                <p className="text-blue-200/70 text-sm">
                  Audit log deletion may only be performed for valid accounting and operational reasons. 
                  Please ensure you have researched and comply with applicable laws and regulations.
                </p>
              </div>
            </div>
          </div>
          
          {/* Audit Retention Warning */}
          <div className="p-4 bg-amber-900/20 border border-amber-700/30 rounded-lg">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 font-medium">Audit Log Retention Requirements</p>
                <p className="text-amber-200/70 text-sm">
                  Many jurisdictions require businesses to retain audit trails for specific periods (often 3-7 years or longer). 
                  Audit trails may <strong>only be deleted after the required retention period</strong> or <strong>never</strong>, depending on applicable laws. 
                  Consult with legal/accounting professionals before deleting audit records.
                </p>
              </div>
            </div>
          </div>
          
          {deleteMode === "single" && entryToDelete && (
            <div className="p-4 bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-400">Action</p>
              <p className="font-medium">{entryToDelete.action.replace(/_/g, " ")}</p>
              <p className="text-sm text-gray-400 mt-2">Description</p>
              <p className="text-sm">{entryToDelete.description}</p>
            </div>
          )}
          
          {deleteMode === "bulk" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Delete entries before date</label>
              <Input
                type="date"
                value={bulkDeleteDate}
                onChange={(e) => setBulkDeleteDate(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
          )}
          
          <div className="flex gap-4 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300"
              onClick={() => {
                setDeleteModalOpen(false);
                setEntryToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting || (deleteMode === "bulk" && !bulkDeleteDate)}
            >
              {deleting ? <LoadingSpinner size="sm" /> : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
