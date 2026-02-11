"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Building2, Monitor, Settings } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <Building2 className="h-12 w-12 text-blue-500" />
          <h1 className="text-4xl font-bold text-white">Azadi POS</h1>
        </div>
        
        <p className="text-gray-400 mb-12 text-lg">
          Welcome! Please select your interface:
        </p>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-64 h-32 flex flex-col gap-3 bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-blue-500 text-white transition-all"
              onClick={() => router.push("/admin")}
            >
              <Settings className="h-8 w-8 text-blue-400" />
              <span className="text-lg font-semibold">Admin Portal</span>
              <span className="text-sm text-gray-400">Manage inventory & employees</span>
            </Button>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-64 h-32 flex flex-col gap-3 bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-green-500 text-white transition-all"
              onClick={() => router.push("/pos")}
            >
              <Monitor className="h-8 w-8 text-green-400" />
              <span className="text-lg font-semibold">POS Terminal</span>
              <span className="text-sm text-gray-400">Process transactions</span>
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}