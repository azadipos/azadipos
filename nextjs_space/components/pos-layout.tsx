"use client";

import { ReactNode } from "react";
import { OfflineIndicator } from "@/components/offline-indicator";

interface POSLayoutProps {
  children: ReactNode;
  companyId?: string;
}

export function POSLayout({ children, companyId }: POSLayoutProps) {
  return (
    <div className="min-h-screen bg-pos-dark text-white">
      {companyId && <OfflineIndicator companyId={companyId} />}
      {children}
    </div>
  );
}