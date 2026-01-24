"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Dashboard route prefetcher
 *
 * Preloads common dashboard routes on mount to enable instant navigation.
 * This component should be mounted in the dashboard layout.
 */
export function DashboardPrefetch() {
  const router = useRouter();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    // Only prefetch once per session
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;

    // Delay prefetching to not block initial render
    const timeoutId = setTimeout(() => {
      // Prefetch the most commonly visited routes
      const routes = [
        "/dashboard",
        "/dashboard/monitors",
        "/dashboard/results",
        "/dashboard/settings",
        "/dashboard/help",
      ];

      routes.forEach((route) => {
        router.prefetch(route);
      });
    }, 1000); // Wait 1 second after mount

    return () => clearTimeout(timeoutId);
  }, [router]);

  // This component renders nothing
  return null;
}

/**
 * Hook for prefetching on hover with debounce
 */
export function usePrefetchOnHover() {
  const router = useRouter();
  const prefetchedRoutes = useRef<Set<string>>(new Set());

  const prefetch = (href: string) => {
    if (!prefetchedRoutes.current.has(href)) {
      router.prefetch(href);
      prefetchedRoutes.current.add(href);
    }
  };

  return { prefetch };
}
