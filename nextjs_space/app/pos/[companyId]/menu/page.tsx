"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePOS } from "@/lib/pos-context";
import { ShoppingCart, LogOut, DollarSign, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function POSMenuPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  const { employee, logout } = usePOS();
  
  useEffect(() => {
    if (!employee) {
      router.push(`/pos/${companyId}/login`);
    }
  }, [employee, companyId, router]);
  
  const handleLogout = () => {
    logout();
    router.push(`/pos/${companyId}/login`);
  };
  
  if (!employee) return null;
  
  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {employee?.name}</h1>
          <p className="text-gray-400">
            {employee?.isManager ? "Manager" : "Cashier"} • Clocked In
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="text-gray-400 hover:text-white"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="grid gap-6 sm:grid-cols-2 w-full max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="pos"
              size="pos-large"
              className="w-full h-40 flex flex-col gap-3 hover:border-green-500"
              onClick={() => router.push(`/pos/${companyId}/transaction`)}
            >
              <ShoppingCart className="h-10 w-10 text-green-400" />
              <span>New Transaction</span>
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="pos"
              size="pos-large"
              className="w-full h-40 flex flex-col gap-3 hover:border-blue-500"
              onClick={() => router.push(`/pos/${companyId}/closeout`)}
            >
              <Lock className="h-10 w-10 text-blue-400" />
              <span>Close Out</span>
            </Button>
          </motion.div>
          
          {/* Placeholder buttons for future phases */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              variant="pos"
              size="pos-large"
              className="w-full h-40 flex flex-col gap-3 opacity-50 cursor-not-allowed"
              disabled
            >
              <DollarSign className="h-10 w-10 text-gray-500" />
              <span className="text-gray-500">Refund</span>
              <span className="text-xs text-gray-600">Coming Soon</span>
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="pos"
              size="pos-large"
              className="w-full h-40 flex flex-col gap-3 opacity-50 cursor-not-allowed"
              disabled
            >
              <DollarSign className="h-10 w-10 text-gray-500" />
              <span className="text-gray-500">Register</span>
              <span className="text-xs text-gray-600">Coming Soon</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}