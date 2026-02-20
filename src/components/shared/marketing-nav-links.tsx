"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const navLinks = [
  { href: "/articles", label: "Articles" },
  { href: "/pricing", label: "Pricing" },
  { href: "mailto:support@kaulbyapp.com", label: "Support", external: true },
];

// A11Y: Active state on marketing nav links — FIX-019
export function MarketingNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navLinks.map((link) => {
        const isActive = !link.external && (pathname === link.href || pathname.startsWith(`${link.href}/`));

        if (link.external) {
          return (
            <a
              key={link.href}
              href={link.href}
              className="text-sm transition-colors hidden md:block text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </a>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-sm transition-colors hidden md:block",
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
