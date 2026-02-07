"use client";

import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const params = useParams();
  const companyId = params?.companyId as string;
  
  return (
    <AdminLayout companyId={companyId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sales Reports</h1>
          <p className="text-gray-400">Analytics and sales breakdown</p>
        </div>
        
        <div className="flex flex-col items-center justify-center py-20 bg-gray-800/50 rounded-lg border border-gray-700">
          <BarChart3 className="h-16 w-16 text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Coming in Phase 4</h2>
          <p className="text-gray-500 text-center max-w-md">
            This feature will provide detailed sales analytics, daily/weekly/monthly reports,
            top-selling items, employee performance metrics, and more.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
