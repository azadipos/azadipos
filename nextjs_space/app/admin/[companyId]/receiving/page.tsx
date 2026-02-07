"use client";

import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { ClipboardList } from "lucide-react";

export default function ReceivingPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Receiving</h1>
          <p className="text-gray-400">Log incoming inventory shipments</p>
        </div>
        
        <div className="flex flex-col items-center justify-center py-20 bg-gray-800/50 rounded-lg border border-gray-700">
          <ClipboardList className="h-16 w-16 text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Coming in Phase 3</h2>
          <p className="text-gray-500 text-center max-w-md">
            This feature will allow you to scan invoice images, auto-log items received, 
            and update inventory quantities automatically.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
