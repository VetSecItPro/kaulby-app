"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Radio,
  MessageSquare,
  Settings,
  CreditCard,
  ShieldCheck,
  HelpCircle,
  Users,
  BarChart3,
  Lightbulb,
  Compass,
  Sparkles,
} from "lucide-react";

const sidebarLinks = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Monitors",
    href: "/dashboard/monitors",
    icon: Radio,
  },
  {
    title: "Audiences",
    href: "/dashboard/audiences",
    icon: Users,
  },
  {
    title: "Results",
    href: "/dashboard/results",
    icon: MessageSquare,
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    title: "Insights",
    href: "/dashboard/insights",
    icon: Lightbulb,
  },
  {
    title: "Discover",
    href: "/dashboard/discover",
    icon: Compass,
  },
  {
    title: "Ask AI",
    href: "/dashboard/ask",
    icon: Sparkles,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
  {
    title: "Help",
    href: "/dashboard/help",
    icon: HelpCircle,
  },
];

interface SidebarProps {
  isAdmin?: boolean;
  subscriptionStatus?: string;
  hasActiveDayPass?: boolean;
  workspaceRole?: "owner" | "member" | null;
}

// Get display name and styling for plan badge
function getPlanBadge(subscriptionStatus: string, hasActiveDayPass: boolean): { label: string; show: boolean } {
  // Day pass takes priority if active
  if (hasActiveDayPass) {
    return { label: "Day Pass", show: true };
  }

  switch (subscriptionStatus) {
    case "enterprise":
      return { label: "Team", show: true };
    case "pro":
      return { label: "Pro", show: true };
    default:
      return { label: "Free", show: true };
  }
}

export function Sidebar({ isAdmin = false, subscriptionStatus = "free", hasActiveDayPass = false, workspaceRole = null }: SidebarProps) {
  const pathname = usePathname();
  const planBadge = getPlanBadge(subscriptionStatus, hasActiveDayPass);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering UserButton after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/40">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-black flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="Kaulby"
              width={28}
              height={28}
              className="object-cover w-full h-full"
            />
          </div>
          <span className="text-xl gradient-text">Kaulby</span>
        </Link>
        {/* Plan Badge */}
        {planBadge.show && (
          <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-amber-400 text-black">
            {planBadge.label}
          </span>
        )}
        {/* Workspace Role Badge - only for Team accounts */}
        {subscriptionStatus === "enterprise" && workspaceRole && (
          <span
            className={cn(
              "ml-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full",
              workspaceRole === "owner"
                ? "bg-gradient-to-r from-amber-300 to-yellow-400 text-black shadow-sm"
                : "bg-slate-600 text-white"
            )}
          >
            {workspaceRole === "owner" ? "Owner" : "Member"}
          </span>
        )}
        {/* Admin Badge */}
        {isAdmin && (
          <span className="ml-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-red-500 text-white">
            Admin
          </span>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(link.href + "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.title}
              </Link>
            );
          })}

          {/* Manage Link (Admin) */}
          {isAdmin && (
            <Link
              href="/manage"
              className={cn(
                "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors mt-2",
                pathname === "/manage" || pathname.startsWith("/manage/")
                  ? "bg-amber-500 text-white"
                  : "text-amber-500 hover:bg-amber-500/10"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin Dashboard
            </Link>
          )}
        </nav>

      </div>

      {/* Billing Link - hidden for Team tier users */}
      {subscriptionStatus !== "enterprise" && (
        <div className="px-2 pb-2">
          <Link
            href="/dashboard/settings"
            className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Upgrade Plan
          </Link>
        </div>
      )}

      {/* User Section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          {mounted ? (
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8"
                }
              }}
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          )}
          <Link href="/dashboard/settings" className="flex flex-col hover:opacity-80 transition-opacity">
            <span className="text-sm font-medium">My Account</span>
            <span className="text-xs text-muted-foreground">Manage settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
