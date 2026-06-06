"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, Building2, ArrowRight, Trash2, AlertTriangle, Info } from "lucide-react";
import { motion } from "framer-motion";

interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export default function AdminLandingPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    fetchCompanies();
  }, []);
  
  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(data ?? []);
    } catch (err) {
      console.error("Failed to fetch companies:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const createCompany = async () => {
    if (!newCompanyName.trim()) {
      setError("Please enter a company name");
      return;
    }
    
    setCreating(true);
    setError("");
    
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName.trim() }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to create company");
      }
      
      const company = await res.json();
      setShowCreateModal(false);
      setNewCompanyName("");
      router.push(`/admin/${company.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create company");
    } finally {
      setCreating(false);
    }
  };
  
  const openDeleteModal = (company: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompanyToDelete(company);
    setDeleteConfirmName("");
    setShowDeleteModal(true);
  };
  
  const deleteCompany = async () => {
    if (!companyToDelete || deleteConfirmName !== companyToDelete.name) {
      setError("Please type the company name exactly to confirm deletion");
      return;
    }
    
    setDeleting(true);
    setError("");
    
    try {
      const res = await fetch(`/api/companies/${companyToDelete.id}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to delete company");
      }
      
      setShowDeleteModal(false);
      setCompanyToDelete(null);
      setDeleteConfirmName("");
      fetchCompanies();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete company");
    } finally {
      setDeleting(false);
    }
  };
  
  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              Company Files
              <button 
                onClick={() => setShowInfoModal(true)}
                className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                title="What are company files?"
              >
                <Info className="h-5 w-5" />
              </button>
            </h1>
            <p className="text-gray-400 mt-1">
              {companies.length === 0 
                ? "Create your company to get started"
                : companies.length === 1 
                  ? "Your company file"
                  : "Select a company to manage (or create additional locations)"}
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {companies.length === 0 ? "Create Company" : "New Location"}
          </Button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : (companies?.length ?? 0) === 0 ? (
          <div className="text-center py-20">
            <Building2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No companies yet</h2>
            <p className="text-gray-500 mt-2">Create your first company to get started</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Company
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies?.map((company, index) => (
              <motion.div
                key={company?.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  onClick={() => router.push(`/admin/${company.id}`)}
                  className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-blue-500 transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600/20 rounded-lg">
                        <Building2 className="h-6 w-6 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{company?.name}</h3>
                        <p className="text-sm text-gray-500">
                          Created {new Date(company?.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => openDeleteModal(company, e)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Delete company"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewCompanyName("");
          setError("");
        }}
        title="Create New Company"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Company Name
            </label>
            <Input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Enter company name"
              className="bg-gray-800 border-gray-600 text-white"
              onKeyDown={(e) => e.key === "Enter" && createCompany()}
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setNewCompanyName("");
                setError("");
              }}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={createCompany}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creating ? <LoadingSpinner size="sm" /> : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Delete Company Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCompanyToDelete(null);
          setDeleteConfirmName("");
          setError("");
        }}
        title="Delete Company"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">This action cannot be undone!</p>
                <p className="text-sm text-gray-300 mt-1">
                  Deleting <strong>{companyToDelete?.name}</strong> will permanently remove all data including:
                </p>
                <ul className="text-sm text-gray-400 mt-2 list-disc list-inside space-y-1">
                  <li>All inventory items and categories</li>
                  <li>All employees and their records</li>
                  <li>All transaction history</li>
                  <li>All customers and loyalty data</li>
                  <li>All promotions and store credits</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type <span className="text-red-400">{companyToDelete?.name}</span> to confirm deletion:
            </label>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type company name to confirm"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          
          {error && <p className="text-red-400 text-sm">{error}</p>}
          
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setCompanyToDelete(null);
                setDeleteConfirmName("");
                setError("");
              }}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={deleteCompany}
              disabled={deleting || deleteConfirmName !== companyToDelete?.name}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? <LoadingSpinner size="sm" /> : "Delete Permanently"}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Info Modal - What are Company Files */}
      <Modal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="About Company Files"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
            <p className="text-gray-300">
              A <strong>Company File</strong> contains all the data for one store location: inventory, employees, transactions, customers, and settings.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-white">For Single-Location Businesses:</h4>
            <p className="text-sm text-gray-400">
              You only need <strong>one company file</strong>. All your POS terminals will automatically connect to it. The system handles this for you - no additional configuration needed.
            </p>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-white">For Multi-Location Businesses:</h4>
            <p className="text-sm text-gray-400">
              Create a separate company file for each store location. Each location maintains its own inventory, employees, and transaction history. When a POS terminal starts, it will let the user select which location they&apos;re working at.
            </p>
          </div>
          
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-500">
              <strong>Note:</strong> All company files share the same database server. Data is kept separate by company ID, ensuring each location&apos;s data remains private.
            </p>
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={() => setShowInfoModal(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}