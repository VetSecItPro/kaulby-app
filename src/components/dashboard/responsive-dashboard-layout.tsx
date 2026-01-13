"use client";

import { ReactNode } from "react";
import { useDevice } from "@/hooks/use-device";
import { MobileDashboardLayout } from "@/components/mobile/mobile-dashboard-layout";
import { Sidebar } from "./sidebar";

interface ResponsiveDashboardLayoutProps {
  children: ReactNode;
  isAdmin: boolean;
  title?: string;
}

export function ResponsiveDashboardLayout({
  children,
  isAdmin,
  title,
}: ResponsiveDashboardLayoutProps) {
  const { isMobile, isTablet } = useDevice();

  // Mobile or tablet view
  if (isMobile || isTablet) {
    return (
      <MobileDashboardLayout title={title}>
        {children}
      </MobileDashboardLayout>
    );
  }

  // Desktop view
  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 overflow-auto">
        <div className="container py-6 px-4 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
