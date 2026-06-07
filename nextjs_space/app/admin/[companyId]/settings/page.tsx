"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Settings,
  Save,
  Image as ImageIcon,
  MapPin,
  Phone,
  FileText,
  Store,
  Eye,
  Upload,
  Printer,
  Shield,
  Lock,
  ChevronRight,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Package,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/helpers";

interface CompanySettings {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
}

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.companyId as string;

  const [loading, setLoading] = useState(true);
  const [adminHasPassword, setAdminHasPassword] = useState(false);

  // Software Update state
  const [currentVersion, setCurrentVersion] = useState("");
  const [lastUpdate, setLastUpdate] = useState<any>(null);
  const [updateHistory, setUpdateHistory] = useState<any[]>([]);
  const [updateFile, setUpdateFile] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, adminRes] = await Promise.all([
          fetch(`/api/companies/${companyId}/settings`),
          fetch(`/api/admin-settings?companyId=${companyId}`),
        ]);
        
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettings(data);
        }
        
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          setAdminHasPassword(adminData.hasPassword);
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      } finally {
        setLoading(false);
      }
    };

    if (companyId) {
      fetchSettings();
    }
    // Fetch version info
    fetch("/api/system/update")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setCurrentVersion(data.version || "1.0.0");
          setLastUpdate(data.lastUpdate || null);
          setUpdateHistory(data.updateHistory || []);
        }
      })
      .catch(() => {});
  }, [companyId]);

  const handleApplyUpdate = async () => {
    if (!updateFile) return;
    setUpdating(true);
    setUpdateResult(null);
    try {
      const formData = new FormData();
      formData.append("updateFile", updateFile);
      const res = await fetch("/api/system/update", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUpdateResult({ success: true, message: data.message });
        setUpdateFile(null);
        if (updateFileRef.current) updateFileRef.current.value = "";
        // Refresh version info
        const verRes = await fetch("/api/system/update");
        if (verRes.ok) {
          const verData = await verRes.json();
          setCurrentVersion(verData.version || currentVersion);
          setLastUpdate(verData.lastUpdate || null);
          setUpdateHistory(verData.updateHistory || []);
        }
      } else {
        setUpdateResult({ success: false, message: data.error || "Update failed" });
      }
    } catch (err: any) {
      setUpdateResult({ success: false, message: err.message || "Update failed" });
    } finally {
      setUpdating(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          logoUrl: settings.logoUrl,
          address: settings.address,
          phone: settings.phone,
          receiptHeader: settings.receiptHeader,
          receiptFooter: settings.receiptFooter,
        }),
      });

      if (res.ok) {
        alert("Settings saved successfully!");
      } else {
        alert("Failed to save settings");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 for simple storage (for small logos)
    const reader = new FileReader();
    reader.onload = () => {
      if (settings && typeof reader.result === "string") {
        setSettings({ ...settings, logoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePrintTest = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const receiptHtml = generateReceiptHtml();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const generateReceiptHtml = () => {
    const s = settings;
    if (!s) return "";

    // Sample transaction for preview
    const sampleItems = [
      { name: "Sample Item 1", qty: 2, price: 9.99, total: 19.98 },
      { name: "Sample Item 2", qty: 1, price: 15.5, total: 15.5 },
      { name: "Sample Item 3 (Weight)", qty: 1.5, price: 4.99, total: 7.49 },
    ];
    const subtotal = 42.97;
    const tax = 3.44;
    const total = 46.41;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { margin: 5mm; }
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 72mm;
            margin: 0 auto;
            padding: 5mm;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 5px 0; }
          .logo { max-width: 50mm; max-height: 25mm; margin: 0 auto 5mm; display: block; }
          .item-row { display: flex; justify-content: space-between; }
          .header { margin-bottom: 10px; }
          .footer { margin-top: 10px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header center">
          ${s.logoUrl ? `<img src="${s.logoUrl}" class="logo" alt="Logo" />` : ""}
          <div class="bold" style="font-size: 14px;">${s.name}</div>
          ${s.address ? `<div>${s.address}</div>` : ""}
          ${s.phone ? `<div>Tel: ${s.phone}</div>` : ""}
          ${s.receiptHeader ? `<div style="margin-top: 5px;">${s.receiptHeader}</div>` : ""}
        </div>
        
        <div class="line"></div>
        <div class="center">SALE</div>
        <div>Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
        <div>Trans #: TXN-20260216-123456</div>
        <div>Cashier: John Doe</div>
        <div class="line"></div>
        
        ${sampleItems
          .map(
            (item) => `
          <div class="item-row">
            <span>${item.name}</span>
          </div>
          <div class="item-row">
            <span style="margin-left: 10px;">${item.qty} x ${formatCurrency(item.price)}</span>
            <span>${formatCurrency(item.total)}</span>
          </div>
        `
          )
          .join("")}
        
        <div class="line"></div>
        <div class="item-row"><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
        <div class="item-row"><span>Tax (8%):</span><span>${formatCurrency(tax)}</span></div>
        <div class="line"></div>
        <div class="item-row bold" style="font-size: 14px;"><span>TOTAL:</span><span>${formatCurrency(total)}</span></div>
        <div class="line"></div>
        <div class="item-row"><span>Payment: Cash</span><span>${formatCurrency(50)}</span></div>
        <div class="item-row"><span>Change:</span><span>${formatCurrency(3.59)}</span></div>
        
        <div style="text-align:center;margin:8px 0;">
          <svg viewBox="0 0 200 40" width="200" height="40" style="margin:0 auto;">
            <rect x="5" y="0" width="2" height="30" fill="black"/>
            <rect x="10" y="0" width="1" height="30" fill="black"/>
            <rect x="14" y="0" width="3" height="30" fill="black"/>
            <rect x="20" y="0" width="1" height="30" fill="black"/>
            <rect x="24" y="0" width="2" height="30" fill="black"/>
            <rect x="30" y="0" width="1" height="30" fill="black"/>
            <rect x="34" y="0" width="3" height="30" fill="black"/>
            <rect x="40" y="0" width="2" height="30" fill="black"/>
            <rect x="46" y="0" width="1" height="30" fill="black"/>
            <rect x="50" y="0" width="2" height="30" fill="black"/>
            <rect x="56" y="0" width="3" height="30" fill="black"/>
            <rect x="62" y="0" width="1" height="30" fill="black"/>
            <rect x="66" y="0" width="2" height="30" fill="black"/>
            <rect x="72" y="0" width="1" height="30" fill="black"/>
            <rect x="76" y="0" width="3" height="30" fill="black"/>
            <rect x="82" y="0" width="2" height="30" fill="black"/>
            <rect x="88" y="0" width="1" height="30" fill="black"/>
            <rect x="94" y="0" width="2" height="30" fill="black"/>
            <rect x="100" y="0" width="3" height="30" fill="black"/>
            <rect x="108" y="0" width="1" height="30" fill="black"/>
            <rect x="114" y="0" width="2" height="30" fill="black"/>
            <rect x="120" y="0" width="1" height="30" fill="black"/>
            <rect x="126" y="0" width="3" height="30" fill="black"/>
            <rect x="134" y="0" width="2" height="30" fill="black"/>
            <rect x="140" y="0" width="1" height="30" fill="black"/>
            <rect x="148" y="0" width="3" height="30" fill="black"/>
            <rect x="156" y="0" width="2" height="30" fill="black"/>
            <rect x="164" y="0" width="1" height="30" fill="black"/>
            <rect x="172" y="0" width="3" height="30" fill="black"/>
            <rect x="180" y="0" width="2" height="30" fill="black"/>
            <text x="100" y="38" text-anchor="middle" font-family="monospace" font-size="8">TXN-20260216-123456</text>
          </svg>
        </div>
        <div class="footer center">
          <div class="line"></div>
          ${s.receiptFooter ? `<div>${s.receiptFooter}</div>` : "<div>Thank you for your purchase!</div>"}
          <div style="margin-top: 5px;">Powered by AzadiPOS</div>
        </div>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <AdminLayout companyId={companyId}>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  if (!settings) {
    return (
      <AdminLayout companyId={companyId}>
        <div className="text-center text-red-400">Failed to load settings</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout companyId={companyId}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold">Store Settings</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </motion.div>

        <div className="grid gap-6">
          {/* Store Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-400" />
              Store Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Store Name</label>
                <Input
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  placeholder="Enter store name"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </label>
                <Input
                  value={settings.address || ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Enter store address"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </label>
                <Input
                  value={settings.phone || ""}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </motion.div>

          {/* Receipt Design */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-400" />
              Receipt Design
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Store Logo
                </label>
                <div className="flex items-center gap-4">
                  {settings.logoUrl && (
                    <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={settings.logoUrl}
                        alt="Store logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {settings.logoUrl ? "Change Logo" : "Upload Logo"}
                    </Button>
                    {settings.logoUrl && (
                      <Button
                        variant="ghost"
                        className="ml-2 text-red-400"
                        onClick={() => setSettings({ ...settings, logoUrl: null })}
                      >
                        Remove
                      </Button>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: 200x100px, PNG or JPG, max 100KB
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Receipt Header Text
                </label>
                <Input
                  value={settings.receiptHeader || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, receiptHeader: e.target.value })
                  }
                  placeholder="e.g., Welcome to our store!"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Displayed below store info, above items
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Receipt Footer Text
                </label>
                <Input
                  value={settings.receiptFooter || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, receiptFooter: e.target.value })
                  }
                  placeholder="e.g., Thank you for your purchase!"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Displayed at the bottom of receipt
                </p>
              </div>
            </div>
          </motion.div>

          {/* Receipt Preview & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Printer className="h-5 w-5 text-purple-400" />
              Preview & Test Print
            </h2>

            <div className="flex gap-4 mb-4">
              <Button onClick={() => setShowPreview(!showPreview)} variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
              <Button onClick={handlePrintTest}>
                <Printer className="h-4 w-4 mr-2" />
                Print Test Receipt
              </Button>
            </div>

            {showPreview && (
              <div className="bg-white text-black p-4 rounded-lg max-w-xs mx-auto font-mono text-xs">
                <div className="text-center mb-2">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="max-w-[150px] max-h-[75px] mx-auto mb-2"
                    />
                  )}
                  <div className="font-bold text-sm">{settings.name}</div>
                  {settings.address && <div>{settings.address}</div>}
                  {settings.phone && <div>Tel: {settings.phone}</div>}
                  {settings.receiptHeader && (
                    <div className="mt-1">{settings.receiptHeader}</div>
                  )}
                </div>
                <div className="border-t border-dashed border-gray-400 my-2" />
                <div className="text-center">SALE</div>
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Trans #: TXN-20260216-123456</div>
                <div>Cashier: John Doe</div>
                <div className="border-t border-dashed border-gray-400 my-2" />
                <div className="flex justify-between">
                  <span>Sample Item 1</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>2 x $9.99</span>
                  <span>$19.98</span>
                </div>
                <div className="flex justify-between">
                  <span>Sample Item 2</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>1 x $15.50</span>
                  <span>$15.50</span>
                </div>
                <div className="border-t border-dashed border-gray-400 my-2" />
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>$35.48</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>$2.84</span>
                </div>
                <div className="border-t border-dashed border-gray-400 my-2" />
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL:</span>
                  <span>$38.32</span>
                </div>
                <div className="border-t border-dashed border-gray-400 my-2" />
                <div className="text-center my-2">
                  <div className="inline-flex flex-col items-center">
                    <div className="flex gap-px">
                      {[2,1,3,1,2,1,3,2,1,2,3,1,2,1,3,2,1,2,3,1,2,1,3,2,1,3,2,1,3,2].map((w, i) => (
                        <div key={i} className={`bg-black`} style={{ width: `${w}px`, height: '30px', display: i % 2 === 0 ? 'block' : 'none' }} />
                      ))}
                    </div>
                    <div className="text-[9px] font-mono mt-0.5">TXN-20260216-123456</div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  {settings.receiptFooter || "Thank you for your purchase!"}
                </div>
              </div>
            )}
          </motion.div>

          {/* Admin Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              Admin Security
            </h2>

            <div className="space-y-4">
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${adminHasPassword ? "bg-green-600/20" : "bg-amber-600/20"}`}>
                      <Lock className={`h-5 w-5 ${adminHasPassword ? "text-green-400" : "text-amber-400"}`} />
                    </div>
                    <div>
                      <p className="font-medium">Password Protection</p>
                      <p className="text-sm text-gray-400">
                        {adminHasPassword
                          ? "Admin panel is password protected"
                          : "No password set - anyone can access admin"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/admin/${companyId}/admin-lock`)}
                    className="border-gray-600"
                  >
                    {adminHasPassword ? "Manage" : "Set Up"}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-200 font-medium">Security Tip</p>
                    <p className="text-blue-200/70 text-sm">
                      Setting an admin password protects sensitive business data from unauthorized access.
                      A master code (default: 999999) allows recovery if you forget your password.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Software Update */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-800 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Download className="h-5 w-5 text-purple-400" />
              Software Update
            </h2>

            <div className="space-y-4">
              {/* Current Version Info */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-600/20">
                    <Package className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium">AzadiPOS v{currentVersion || "1.0.0"}</p>
                    <p className="text-sm text-gray-400">
                      {lastUpdate
                        ? `Last updated: ${new Date(lastUpdate.timestamp).toLocaleDateString()} — ${lastUpdate.description}`
                        : "No updates applied yet"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Update File Selection */}
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-3">
                <p className="text-sm text-gray-300 font-medium">Apply Update</p>
                <p className="text-xs text-gray-500">
                  Select an update file (.zip or .azupdate) from USB drive or local storage.
                  Updates will not affect your data — only application files are replaced.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={updateFileRef}
                    type="file"
                    accept=".zip,.azupdate"
                    onChange={(e) => {
                      setUpdateFile(e.target.files?.[0] || null);
                      setUpdateResult(null);
                    }}
                    className="flex-1 text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer"
                  />
                  <Button
                    onClick={handleApplyUpdate}
                    disabled={!updateFile || updating}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  >
                    {updating ? (
                      <><LoadingSpinner size="sm" /> Applying...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" /> Apply Update</>
                    )}
                  </Button>
                </div>

                {/* Update Result */}
                {updateResult && (
                  <div className={`p-3 rounded-lg border text-sm ${
                    updateResult.success
                      ? "bg-green-900/20 border-green-700/30 text-green-300"
                      : "bg-red-900/20 border-red-700/30 text-red-300"
                  }`}>
                    <div className="flex items-start gap-2">
                      {updateResult.success
                        ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                      <span>{updateResult.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Update History */}
              {updateHistory.length > 0 && (
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-300 font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Update History
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {[...updateHistory].reverse().map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-gray-400 py-1 border-b border-gray-700/50 last:border-0">
                        <span>{entry.description || entry.fileName}</span>
                        <span className="text-gray-500">
                          {new Date(entry.timestamp).toLocaleDateString()} — {entry.filesUpdated} files
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Download className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-purple-200 font-medium">How Updates Work</p>
                    <p className="text-purple-200/70 text-sm">
                      Update files are provided as .zip packages. Connect a USB drive with the update file,
                      select it above, and click Apply. Your inventory, transactions, and all business data
                      are preserved — only the software code is updated. After applying, restart the application.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
}
