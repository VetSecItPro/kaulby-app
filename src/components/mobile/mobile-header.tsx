"use client";

import { memo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, BarChart3, Lightbulb, Compass, Sparkles, Users, HelpCircle, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { UserButton, useUser } from "@clerk/nextjs";
import type { WorkspaceRole } from "@/lib/permissions";

// Navigation items not in the bottom nav
const menuItems = [
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Insights", href: "/dashboard/insights", icon: Lightbulb },
  { title: "Discover", href: "/dashboard/discover", icon: Compass },
  { title: "Ask Kaulby AI", href: "/dashboard/ask", icon: Sparkles },
  { title: "Audiences", href: "/dashboard/audiences", icon: Users },
  { title: "Help", href: "/dashboard/help", icon: HelpCircle },
];

interface MobileHeaderProps {
  subscriptionStatus?: string;
  hasActiveDayPass?: boolean;
  dayPassExpiresAt?: string | null;
  workspaceRole?: WorkspaceRole | null;
  isAdmin?: boolean;
}

// Get display name and styling for plan badge
function getPlanBadge(subscriptionStatus: string, hasActiveDayPass: boolean): { label: string; className: string } {
  if (hasActiveDayPass) {
    return { label: "Day Pass", className: "bg-purple-500 text-white" };
  }
  switch (subscriptionStatus) {
    case "enterprise":
      return { label: "Team", className: "bg-amber-400 text-black" };
    case "pro":
      return { label: "Pro", className: "bg-teal-500 text-black" };
    default:
      return { label: "Free", className: "bg-gray-500 text-white" };
  }
}

// Day Pass countdown timer component
function DayPassTimer({ expiresAt }: { expiresAt: string }) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        return "Expired";
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
      }
      return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    };

    setTimeRemaining(calculateTime());
    const interval = setInterval(() => {
      setTimeRemaining(calculateTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wide rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30">
      {timeRemaining}
    </span>
  );
}

const NavLink = memo(function NavLink({
  href,
  icon: Icon,
  title,
  isActive,
}: {
  href: string;
  icon: typeof BarChart3;
  title: string;
  isActive: boolean;
}) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground/80 hover:bg-muted active:bg-muted/80"
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="font-medium">{title}</span>
      </Link>
    </SheetClose>
  );
});

export const MobileHeader = memo(function MobileHeader({
  subscriptionStatus = "free",
  hasActiveDayPass = false,
  dayPassExpiresAt = null,
  workspaceRole = null,
  isAdmin = false,
}: MobileHeaderProps) {
  const pathname = usePathname();
  const planBadge = getPlanBadge(subscriptionStatus, hasActiveDayPass);
  const { user } = useUser();

  // Mounted state to prevent hydration mismatch with Clerk's UserButton
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get user's display name
  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "My Account";

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo and badges */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Kaulby"
                width={32}
                height={32}
                className="object-cover w-full h-full"
                priority
              />
            </div>
            <span className="font-semibold text-lg">Kaulby</span>
          </Link>
          {/* Plan Badge */}
          <span className={cn(
            "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full",
            planBadge.className
          )}>
            {planBadge.label}
          </span>
          {/* Day Pass Timer */}
          {hasActiveDayPass && dayPassExpiresAt && (
            <DayPassTimer expiresAt={dayPassExpiresAt} />
          )}
          {/* Workspace Role Badge */}
          {subscriptionStatus === "enterprise" && workspaceRole && (
            <span
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded-full",
                workspaceRole === "owner"
                  ? "bg-gradient-to-r from-amber-300 to-yellow-400 text-black"
                  : "bg-slate-600 text-white"
              )}
            >
              {workspaceRole === "owner" ? "Owner" : "Member"}
            </span>
          )}
        </div>

        {/* Menu Button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] p-0">
            <SheetHeader className="p-4 pb-2 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-left">Menu</SheetTitle>
                <div className={cn(
                  "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full",
                  planBadge.className
                )}>
                  {planBadge.label}
                </div>
              </div>
            </SheetHeader>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1 p-3">
              {menuItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    isActive={isActive}
                  />
                );
              })}

              {/* Admin Dashboard - only for admins */}
              {isAdmin && (
                <SheetClose asChild>
                  <Link
                    href="/manage"
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors mt-2",
                      pathname === "/manage" || pathname.startsWith("/manage/")
                        ? "bg-amber-500 text-white"
                        : "text-amber-500 hover:bg-amber-500/10 active:bg-amber-500/20"
                    )}
                  >
                    <ShieldCheck className="h-5 w-5" />
                    <span className="font-medium">Admin Dashboard</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded-full bg-red-500 text-white">
                      Admin
                    </span>
                  </Link>
                </SheetClose>
              )}
            </nav>

            {/* Divider */}
            <div className="border-t mx-4" />

            {/* Upgrade CTA - only for non-Team users */}
            {subscriptionStatus !== "enterprise" && (
              <div className="p-4">
                <SheetClose asChild>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-black font-semibold transition-transform active:scale-[0.98]"
                  >
                    <CreditCard className="h-4 w-4" />
                    Upgrade Plan
                  </Link>
                </SheetClose>
              </div>
            )}

            {/* User Section */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background safe-area-bottom">
              <div className="flex items-center gap-3">
                {mounted ? (
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "h-10 w-10"
                      }
                    }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground">Manage profile</p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
});
