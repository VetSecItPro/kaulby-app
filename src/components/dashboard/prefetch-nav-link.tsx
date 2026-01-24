"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ComponentProps, useCallback, useState } from "react";

interface PrefetchNavLinkProps extends Omit<ComponentProps<typeof Link>, "prefetch"> {
  /**
   * Whether to prefetch on hover (default: true)
   * Set to false for less important links
   */
  prefetchOnHover?: boolean;
}

/**
 * Navigation link with smart prefetching
 *
 * By default, Next.js prefetches all links in the viewport.
 * This component disables automatic prefetch and only prefetches on hover,
 * reducing unnecessary requests while still providing instant navigation.
 */
export function PrefetchNavLink({
  children,
  href,
  prefetchOnHover = true,
  ...props
}: PrefetchNavLinkProps) {
  const router = useRouter();
  const [hasPrefetched, setHasPrefetched] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (prefetchOnHover && !hasPrefetched && typeof href === "string") {
      router.prefetch(href);
      setHasPrefetched(true);
    }
  }, [router, href, prefetchOnHover, hasPrefetched]);

  // For touch devices, prefetch on touch start
  const handleTouchStart = useCallback(() => {
    if (prefetchOnHover && !hasPrefetched && typeof href === "string") {
      router.prefetch(href);
      setHasPrefetched(true);
    }
  }, [router, href, prefetchOnHover, hasPrefetched]);

  return (
    <Link
      href={href}
      prefetch={false} // Disable automatic prefetch
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * Hook to preload critical dashboard routes
 * Use this in the dashboard layout to preload common navigation paths
 */
export function usePrefetchDashboardRoutes() {
  const router = useRouter();

  const prefetchRoutes = useCallback(() => {
    // Prefetch the most common dashboard routes
    const routes = [
      "/dashboard",
      "/dashboard/monitors",
      "/dashboard/results",
      "/dashboard/settings",
    ];

    routes.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  return { prefetchRoutes };
}
