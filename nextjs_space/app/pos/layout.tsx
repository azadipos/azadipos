"use client";

import { POSProvider } from "@/lib/pos-context";
import { POSLayout } from "@/components/pos-layout";

export default function POSRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <POSProvider>
      <POSLayout>{children}</POSLayout>
    </POSProvider>
  );
}