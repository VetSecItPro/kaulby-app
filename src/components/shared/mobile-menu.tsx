"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navLinks } from "@/components/shared/marketing-nav-links";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px]">
        <SheetHeader>
          <SheetTitle className="text-left gradient-text">Kaulby</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 mt-6">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                prefetch={true}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t pt-6">
          <Link href="/sign-in" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-start">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up" onClick={() => setOpen(false)}>
            <Button className="w-full">Get Started</Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
