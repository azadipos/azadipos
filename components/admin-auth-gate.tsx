"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Shield, Lock, Key, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

interface AdminAuthGateProps {
  companyId: string;
  children: React.ReactNode;
}

export function AdminAuthGate({ companyId, children }: AdminAuthGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  
  // Check if already authenticated in this session
  const sessionKey = `admin_auth_${companyId}`;
  
  useEffect(() => {
    checkAuth();
  }, [companyId]);
  
  const checkAuth = async () => {
    setLoading(true);
    try {
      // Check session storage first
      if (typeof window !== "undefined") {
        const authenticated = sessionStorage.getItem(sessionKey);
        if (authenticated === "true") {
          setIsLocked(false);
          setLoading(false);
          return;
        }
      }
      
      // Check if company has password protection
      const res = await fetch(`/api/admin-settings?companyId=${companyId}`);
      const data = await res.json();
      
      if (data.hasPassword && data.isLocked) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
        // No password set, mark as authenticated
        if (typeof window !== "undefined") {
          sessionStorage.setItem(sessionKey, "true");
        }
      }
    } catch (err) {
      console.error("Failed to check admin auth:", err);
      setIsLocked(false);
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerify = async () => {
    if (!password.trim()) {
      setError("Please enter a password");
      return;
    }
    
    setVerifying(true);
    setError("");
    
    try {
      const res = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          action: "verify",
          password,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Invalid password");
      }
      
      // Success - store in session and unlock
      if (typeof window !== "undefined") {
        sessionStorage.setItem(sessionKey, "true");
      }
      setIsLocked(false);
      
      if (data.usedMasterCode) {
        // Could show a warning that master code was used
        console.log("Access granted via master code");
      }
    } catch (err: any) {
      setError(err.message || "Invalid password");
    } finally {
      setVerifying(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (isLocked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-8"
        >
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-10 w-10 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold">Admin Access</h1>
            <p className="text-gray-400 mt-2">
              Enter password to access admin panel
            </p>
          </div>
          
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <p className="text-red-200 text-sm">{error}</p>
            </motion.div>
          )}
          
          <div className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter admin password"
                className="bg-gray-700 border-gray-600 text-white pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? <LoadingSpinner size="sm" /> : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Unlock
                </>
              )}
            </Button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <Key className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                Forgot your password? Use your master code to gain access.
                The default master code is <strong>999999</strong>.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
  
  return <>{children}</>;
}
