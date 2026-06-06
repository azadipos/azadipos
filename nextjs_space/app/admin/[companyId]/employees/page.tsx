"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, Edit2, Users, Shield, UserCheck, UserX, Printer, RefreshCw, Barcode } from "lucide-react";
import { motion } from "framer-motion";

interface Employee {
  id: string;
  name: string;
  barcode: string | null;
  isManager: boolean;
  inSales: boolean;
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
  const [printEmployee, setPrintEmployee] = useState<Employee | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({ name: "", isManager: false, inSales: true });
  
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
      setFormData({ name: employee.name, isManager: employee.isManager, inSales: employee.inSales ?? true });
    } else {
      setEditingEmployee(null);
      setFormData({ name: "", isManager: false, inSales: true });
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
    if (!formData.name.trim()) {
      setError("Name is required");
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
  
  const regenerateBarcode = async (employee: Employee) => {
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...employee, regenerateBarcode: true }),
      });
      if (res.ok) {
        fetchEmployees();
      }
    } catch (err) {
      console.error("Failed to regenerate barcode:", err);
    }
  };
  
  const handlePrint = (employee: Employee) => {
    setPrintEmployee(employee);
    setTimeout(() => {
      if (printRef.current) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Employee Barcode - ${employee.name}</title>
                <style>
                  @page { size: 2in 1in; margin: 0; }
                  body { font-family: Arial, sans-serif; margin: 0; padding: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
                  .barcode-container { text-align: center; padding: 8px; border: 1px solid #000; border-radius: 4px; }
                  .name { font-size: 12px; font-weight: bold; margin-bottom: 4px; }
                  .barcode { font-size: 14px; font-family: monospace; letter-spacing: 2px; font-weight: bold; }
                  .label { font-size: 8px; color: #666; margin-top: 4px; }
                </style>
              </head>
              <body>
                <div class="barcode-container">
                  <div class="name">${employee.name}</div>
                  <div class="barcode">${employee.barcode || "N/A"}</div>
                  <div class="label">Scan to clock in</div>
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
        }
      }
      setPrintEmployee(null);
    }, 100);
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{employee?.name}</h3>
                            {employee?.isManager && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
                                <Shield className="h-3 w-3" />
                                Manager
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Barcode className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-green-400 font-mono">{employee?.barcode || "No barcode"}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-2">Click to view stats →</p>
                        </div>
                        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => handlePrint(employee)} className="text-gray-400 hover:text-green-400" title="Print Barcode">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => regenerateBarcode(employee)} className="text-gray-400 hover:text-yellow-400" title="Regenerate Barcode">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openModal(employee)} className="text-gray-400 hover:text-white" title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleEmployeeStatus(employee)} className="text-gray-400 hover:text-red-400" title="Deactivate">
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
          {editingEmployee && editingEmployee.barcode && (
            <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Employee Barcode</p>
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-green-400" />
                <span className="font-mono text-green-400 text-lg">{editingEmployee.barcode}</span>
              </div>
            </div>
          )}
          {!editingEmployee && (
            <p className="text-sm text-gray-500">
              A unique barcode will be automatically generated for this employee.
            </p>
          )}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isManager}
                onChange={(e) => setFormData({ ...formData, isManager: e.target.checked })}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm text-gray-300">Manager (can authorize refunds, close registers, etc.)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.inSales}
                onChange={(e) => setFormData({ ...formData, inSales: e.target.checked })}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600"
              />
              <span className="text-sm text-gray-300">In Sales (included in sales metrics and comparisons)</span>
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