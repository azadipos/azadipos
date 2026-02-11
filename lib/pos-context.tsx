"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface Employee {
  id: string;
  name: string;
  isManager: boolean;
}

interface POSContextType {
  companyId: string | null;
  setCompanyId: (id: string | null) => void;
  employee: Employee | null;
  setEmployee: (emp: Employee | null) => void;
  shiftId: string | null;
  setShiftId: (id: string | null) => void;
  logout: () => void;
  closeShift: () => void;
}

const POSContext = createContext<POSContextType | null>(null);

export function POSProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // Load from localStorage on mount
    const storedCompanyId = localStorage.getItem("pos_company_id");
    const storedEmployee = localStorage.getItem("pos_employee");
    const storedShiftId = localStorage.getItem("pos_shift_id");
    
    if (storedCompanyId) setCompanyId(storedCompanyId);
    if (storedEmployee) {
      try {
        setEmployee(JSON.parse(storedEmployee));
      } catch (e) {
        console.error("Failed to parse stored employee", e);
      }
    }
    if (storedShiftId) setShiftId(storedShiftId);
  }, []);
  
  useEffect(() => {
    if (mounted) {
      if (companyId) {
        localStorage.setItem("pos_company_id", companyId);
      } else {
        localStorage.removeItem("pos_company_id");
      }
    }
  }, [companyId, mounted]);
  
  useEffect(() => {
    if (mounted) {
      if (employee) {
        localStorage.setItem("pos_employee", JSON.stringify(employee));
      } else {
        localStorage.removeItem("pos_employee");
      }
    }
  }, [employee, mounted]);
  
  useEffect(() => {
    if (mounted) {
      if (shiftId) {
        localStorage.setItem("pos_shift_id", shiftId);
      } else {
        localStorage.removeItem("pos_shift_id");
      }
    }
  }, [shiftId, mounted]);
  
  const logout = () => {
    setEmployee(null);
    setShiftId(null);
    localStorage.removeItem("pos_employee");
    localStorage.removeItem("pos_shift_id");
  };
  
  const closeShift = () => {
    setShiftId(null);
    setEmployee(null);
    localStorage.removeItem("pos_shift_id");
    localStorage.removeItem("pos_employee");
  };
  
  if (!mounted) {
    return null;
  }
  
  return (
    <POSContext.Provider
      value={{
        companyId,
        setCompanyId,
        employee,
        setEmployee,
        shiftId,
        setShiftId,
        logout,
        closeShift,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error("usePOS must be used within a POSProvider");
  }
  return context;
}