"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Smart navigation link that prefetches on hover for instant navigation.
 * Uses Next.js router.prefetch() triggered on mouseEnter for optimal performance.
 */
export function NavLink({
  href,
  children,
  className,
  prefetch = false,
}: NavLinkProps) {
  const router = useRouter();

  const handleMouseEnter = useCallback(() => {
    router.prefetch(href);
  }, [router, href]);

  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={handleMouseEnter}
      prefetch={prefetch} // Disable automatic prefetch, use hover instead
    >
      {children}
    </Link>
  );
}
