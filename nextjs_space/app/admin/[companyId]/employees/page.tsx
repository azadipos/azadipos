"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, Edit2, Trash2, Users, Shield, UserCheck, UserX } from "lucide-react";
import { motion } from "framer-motion";

interface Employee {
  id: string;
  name: string;
  pin: string;
  isManager: boolean;
  isActive: boolean;
}

export default function EmployeesPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({ name: "", pin: "", isManager: false });
  
  useEffect(() => {
    fetchEmployees();
  }, [companyId]);
  
  const fetchEmployees = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/employees`);
      const data = await res.json();
      setEmployees(data ?? []);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const openModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({ name: employee.name, pin: employee.pin, isManager: employee.isManager });
    } else {
      setEditingEmployee(null);
      setFormData({ name: "", pin: "", isManager: false });
    }
    setError("");
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setError("");
  };
  
  const saveEmployee = async () => {
    if (!formData.name.trim() || !formData.pin.trim()) {
      setError("Name and PIN are required");
      return;
    }
    if (formData.pin.length < 4 || formData.pin.length > 6) {
      setError("PIN must be 4-6 digits");
      return;
    }
    if (!/^\d+$/.test(formData.pin)) {
      setError("PIN must contain only numbers");
      return;
    }
    
    setSaving(true);
    setError("");
    
    try {
      const url = editingEmployee
        ? `/api/employees/${editingEmployee.id}`
        : `/api/companies/${companyId}/employees`;
      const method = editingEmployee ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Failed to save employee");
      }
      
      closeModal();
      fetchEmployees();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };
  
  const toggleEmployeeStatus = async (employee: Employee) => {
    try {
      await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...employee, isActive: !employee.isActive }),
      });
      fetchEmployees();
    } catch (err) {
      console.error("Failed to toggle employee status:", err);
    }
  };
  
  const activeEmployees = (employees ?? []).filter((e) => e?.isActive);
  const inactiveEmployees = (employees ?? []).filter((e) => !e?.isActive);
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Employees</h1>
            <p className="text-gray-400 mt-1">Manage staff and PIN access</p>
          </div>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : (employees?.length ?? 0) === 0 ? (
          <div className="text-center py-20">
            <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400">No employees yet</h2>
            <p className="text-gray-500 mt-2">Add employees to enable POS login</p>
          </div>
        ) : (
          <>
            {activeEmployees.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-300 mb-4">Active Employees</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {activeEmployees.map((employee, index) => (
                    <motion.div
                      key={employee?.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/${companyId}/employees/${employee?.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{employee?.name}</h3>
                            {employee?.isManager && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
                                <Shield className="h-3 w-3" />
                                Manager
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1 font-mono">PIN: {employee?.pin}</p>
                          <p className="text-xs text-gray-600 mt-2">Click to view stats \u2192</p>
                        </div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openModal(employee)} className="text-gray-400 hover:text-white">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleEmployeeStatus(employee)} className="text-gray-400 hover:text-red-400">
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            
            {inactiveEmployees.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-500 mb-4">Inactive Employees</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inactiveEmployees.map((employee) => (
                    <div key={employee?.id} className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg opacity-60">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{employee?.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">Deactivated</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => toggleEmployeeStatus(employee)} className="text-gray-500 hover:text-green-400">
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      <Modal isOpen={showModal} onClose={closeModal} title={editingEmployee ? "Edit Employee" : "Add Employee"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter employee name"
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">PIN (4-6 digits) *</label>
            <Input
              type="password"
              maxLength={6}
              value={formData.pin}
              onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })}
              placeholder="Enter PIN"
              className="bg-gray-800 border-gray-600 text-white font-mono tracking-widest"
            />
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isManager}
                onChange={(e) => setFormData({ ...formData, isManager: e.target.checked })}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm text-gray-300">Manager (can close out registers)</span>
            </label>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal} className="border-gray-600 text-gray-300 hover:bg-gray-800">
              Cancel
            </Button>
            <Button onClick={saveEmployee} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <LoadingSpinner size="sm" /> : editingEmployee ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}