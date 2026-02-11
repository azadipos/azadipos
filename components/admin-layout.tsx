"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package,
  Users,
  Receipt,
  Home,
  Building2,
  Tags,
  Truck,
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  companyId?: string;
  companyName?: string;
}

export function AdminLayout({ children, companyId, companyName }: AdminLayoutProps) {
  const pathname = usePathname();
  
  const navItems = companyId
    ? [
        { href: `/admin/${companyId}`, label: "Dashboard", icon: Home },
        { href: `/admin/${companyId}/inventory`, label: "Inventory", icon: Package },
        { href: `/admin/${companyId}/categories`, label: "Categories", icon: Tags },
        { href: `/admin/${companyId}/vendors`, label: "Vendors", icon: Truck },
        { href: `/admin/${companyId}/employees`, label: "Employees", icon: Users },
        { href: `/admin/${companyId}/transactions`, label: "Transactions", icon: Receipt },
      ]
    : [];
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-gray-900/75">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" />
            <span className="text-xl font-bold">Azadi POS</span>
          </Link>
          {companyName && (
            <span className="text-gray-400">{companyName}</span>
          )}
        </div>
      </header>
      
      {companyId && navItems.length > 0 && (
        <nav className="border-b border-gray-800 bg-gray-900/50">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
      
      <main className="container max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}