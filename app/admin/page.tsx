"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, Building2, ArrowRight } from "lucide-react";
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
  const [newCompanyName, setNewCompanyName] = useState("");
  const [creating, setCreating] = useState(false);
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
  
  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Company Files</h1>
            <p className="text-gray-400 mt-1">Select or create a company to manage</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Company
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
                <button
                  onClick={() => router.push(`/admin/${company.id}`)}
                  className="w-full p-6 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 hover:border-blue-500 transition-all text-left group"
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
                    <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
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
    </AdminLayout>
  );
}