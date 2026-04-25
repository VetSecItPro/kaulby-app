"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/manage/observability", label: "Overview" },
  { href: "/manage/observability/cadence", label: "Cadence" },
  { href: "/manage/observability/costs", label: "AI Costs" },
  { href: "/manage/observability/vendors", label: "Vendors" },
  { href: "/manage/observability/failures", label: "Failures" },
];

export function ObservabilityTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b">
      <nav className="flex gap-1 -mb-px">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
