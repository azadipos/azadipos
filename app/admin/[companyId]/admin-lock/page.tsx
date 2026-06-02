"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { NumericKeypad } from "@/components/numeric-keypad";
import { Lock, Unlock, Key, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLockPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;
  
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [mode, setMode] = useState<"setup" | "change" | "remove">("setup");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [masterCode, setMasterCode] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    fetchSettings();
  }, [companyId]);
  
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin-settings?companyId=${companyId}`);
      const data = await res.json();
      setHasPassword(data.hasPassword);
      setMode(data.hasPassword ? "change" : "setup");
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSetPassword = async () => {
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          action: "setPassword",
          password,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccess("Admin password set successfully!");
      setHasPassword(true);
      setPassword("");
      setConfirmPassword("");
      setStep(1);
      setTimeout(() => {
        router.push(`/admin/${companyId}/settings`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to set password");
    } finally {
      setSaving(false);
    }
  };
  
  const handleRemovePassword = async () => {
    if (!masterCode) {
      setError("Master code required");
      return;
    }
    
    setSaving(true);
    setError("");
    
    try {
      const res = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          action: "removePassword",
          masterCode,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccess("Admin password removed!");
      setHasPassword(false);
      setMode("setup");
      setMasterCode("");
    } catch (err: any) {
      setError(err.message || "Invalid master code");
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 border border-gray-700 rounded-xl p-8"
        >
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold">Admin Security</h1>
            <p className="text-gray-400 mt-2">
              {hasPassword ? "Manage your admin password" : "Set up admin password protection"}
            </p>
          </div>
          
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-900/30 border border-green-700/50 rounded-lg flex items-center gap-3"
            >
              <CheckCircle className="h-5 w-5 text-green-400" />
              <p className="text-green-200">{success}</p>
            </motion.div>
          )}
          
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <p className="text-red-200">{error}</p>
            </motion.div>
          )}
          
          {!hasPassword ? (
            // Setup new password
            <div className="space-y-6">
              <div className="p-4 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-200 font-medium">Master Code</p>
                    <p className="text-amber-200/70 text-sm">
                      Your master code is <strong className="text-white">999999</strong> by default.
                      Use this to recover access if you forget your password.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">New Admin Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 4 characters)"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600"
                  onClick={() => router.push(`/admin/${companyId}/settings`)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSetPassword}
                  disabled={saving}
                >
                  {saving ? <LoadingSpinner size="sm" /> : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Set Password
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Manage existing password
            <div className="space-y-6">
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => { setMode("change"); setError(""); }}
                  className={`flex-1 p-4 rounded-lg border transition-colors ${
                    mode === "change"
                      ? "bg-blue-900/30 border-blue-500 text-blue-400"
                      : "border-gray-600 text-gray-400 hover:bg-gray-700/50"
                  }`}
                >
                  <Lock className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">Change Password</p>
                </button>
                <button
                  onClick={() => { setMode("remove"); setError(""); }}
                  className={`flex-1 p-4 rounded-lg border transition-colors ${
                    mode === "remove"
                      ? "bg-red-900/30 border-red-500 text-red-400"
                      : "border-gray-600 text-gray-400 hover:bg-gray-700/50"
                  }`}
                >
                  <Unlock className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">Remove Password</p>
                </button>
              </div>
              
              {mode === "change" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">New Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Confirm New Password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleSetPassword}
                    disabled={saving}
                  >
                    {saving ? <LoadingSpinner size="sm" /> : "Update Password"}
                  </Button>
                </div>
              )}
              
              {mode === "remove" && (
                <div className="space-y-4">
                  <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
                    <p className="text-red-200 text-sm">
                      Enter your master code to remove the admin password.
                      This will disable password protection.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Master Code</label>
                    <Input
                      type="password"
                      value={masterCode}
                      onChange={(e) => setMasterCode(e.target.value)}
                      placeholder="Enter master code"
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <Button
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={handleRemovePassword}
                    disabled={saving}
                  >
                    {saving ? <LoadingSpinner size="sm" /> : "Remove Password"}
                  </Button>
                </div>
              )}
              
              <Button
                variant="outline"
                className="w-full border-gray-600"
                onClick={() => router.push(`/admin/${companyId}/settings`)}
              >
                Back to Settings
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
