"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Radio,
  MessageSquare,
  Settings,
  CreditCard,
  PlusCircle,
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
    title: "Results",
    href: "/dashboard/results",
    icon: MessageSquare,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/40">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">Kaulby</span>
        </Link>
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
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
        </nav>

        {/* Create Monitor Button */}
        <div className="mt-4 px-2">
          <Link href="/dashboard/monitors/new">
            <Button className="w-full gap-2" size="sm">
              <PlusCircle className="h-4 w-4" />
              New Monitor
            </Button>
          </Link>
        </div>
      </div>

      {/* Billing Link */}
      <div className="px-2 pb-2">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          Upgrade Plan
        </Link>
      </div>

      {/* User Section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-8 w-8"
              }
            }}
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium">My Account</span>
            <span className="text-xs text-muted-foreground">Manage settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
