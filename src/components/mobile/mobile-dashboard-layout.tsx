"use client";

import { ReactNode } from "react";
import { MobileNav } from "./mobile-nav";
import { MobileHeader } from "./mobile-header";

interface MobileDashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export function MobileDashboardLayout({
  children,
  title,
  showBackButton = false,
}: MobileDashboardLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader title={title} showBackButton={showBackButton} />
      <main className="flex-1 overflow-auto pb-20 px-4 pt-4">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
