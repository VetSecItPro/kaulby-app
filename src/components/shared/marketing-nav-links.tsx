"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/articles", label: "Articles" },
  { href: "/pricing", label: "Pricing" },
];

// A11Y: Active state on marketing nav links — FIX-019
export function MarketingNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navLinks.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm transition-colors hidden sm:block",
              isActive
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            prefetch={true}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
