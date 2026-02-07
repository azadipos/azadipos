"use client";

import { ReactNode } from "react";

interface POSLayoutProps {
  children: ReactNode;
}

export function POSLayout({ children }: POSLayoutProps) {
  return (
    <div className="min-h-screen bg-pos-dark text-white">
      {children}
    </div>
  );
}