"use client";

import { ReactNode } from "react";
import { MobileNav } from "@/components/mobile/mobile-nav";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { Sidebar } from "./sidebar";

interface ResponsiveDashboardLayoutProps {
  children: ReactNode;
  isAdmin: boolean;
  subscriptionStatus?: string;
  hasActiveDayPass?: boolean;
  dayPassExpiresAt?: string | null;
  workspaceRole?: "owner" | "member" | null;
}

// CSS-based responsive layout - no JS device detection needed
// This prevents layout flash by using CSS media queries instead of useDevice()
export function ResponsiveDashboardLayout({
  children,
  isAdmin,
  subscriptionStatus = "free",
  hasActiveDayPass = false,
  dayPassExpiresAt = null,
  workspaceRole = null,
}: ResponsiveDashboardLayoutProps) {
  return (
    <>
      {/* Mobile/Tablet Layout - visible below lg breakpoint */}
      <div className="flex flex-col min-h-screen bg-background lg:hidden">
        <MobileHeader
          subscriptionStatus={subscriptionStatus}
          hasActiveDayPass={hasActiveDayPass}
          dayPassExpiresAt={dayPassExpiresAt}
          workspaceRole={workspaceRole}
          isAdmin={isAdmin}
        />
        <main className="flex-1 overflow-auto pb-20 px-4 pt-4">
          {children}
        </main>
        <MobileNav />
      </div>

      {/* Desktop Layout - visible at lg breakpoint and above */}
      <div className="hidden lg:flex min-h-screen">
        <Sidebar
          isAdmin={isAdmin}
          subscriptionStatus={subscriptionStatus}
          hasActiveDayPass={hasActiveDayPass}
          dayPassExpiresAt={dayPassExpiresAt}
          workspaceRole={workspaceRole}
        />
        <main className="flex-1 overflow-auto">
          <div className="container py-6 px-4 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
