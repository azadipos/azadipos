"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { usePOS } from "@/lib/pos-context";
import { Building2, Monitor } from "lucide-react";
import { motion } from "framer-motion";

interface Company {
  id: string;
  name: string;
}

export default function POSSelectCompanyPage() {
  const router = useRouter();
  const { setCompanyId } = usePOS();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchCompanies();
  }, []);
  
  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      const companyList = Array.isArray(data) ? data : [];
      setCompanies(companyList);
      
      // Auto-select if only one company exists
      if (companyList.length === 1) {
        setCompanyId(companyList[0].id);
        router.replace(`/pos/${companyList[0].id}/login`);
      }
    } catch (err) {
      console.error("Failed to fetch companies:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const selectCompany = (company: Company) => {
    setCompanyId(company.id);
    router.push(`/pos/${company.id}/login`);
  };
  
  // Show loading while auto-selecting single company
  if (loading || companies.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <Monitor className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold">POS Terminal</h1>
        <p className="text-gray-400 mt-2">Select a company to continue</p>
      </motion.div>
      
      {companies.length === 0 ? (
        <div className="text-center">
          <p className="text-gray-500">No companies found</p>
          <p className="text-sm text-gray-600 mt-2">Create a company in the Admin Portal first</p>
        </div>
      ) : (
        <div className="grid gap-4 w-full max-w-md">
          {companies.map((company, index) => (
            <motion.div
              key={company?.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Button
                variant="pos"
                className="w-full h-20 text-lg justify-start gap-4"
                onClick={() => selectCompany(company)}
              >
                <Building2 className="h-6 w-6 text-green-400" />
                {company?.name}
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}