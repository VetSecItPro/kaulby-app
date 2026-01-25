"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Preloads critical dashboard routes on mount for instant navigation.
 * This component renders nothing but prefetches common routes in the background.
 */
export function RoutePreloader() {
  const router = useRouter();

  useEffect(() => {
    // Preload most common dashboard routes after a short delay
    // to avoid competing with initial page load
    const timer = setTimeout(() => {
      const criticalRoutes = [
        "/dashboard/monitors",
        "/dashboard/results",
        "/dashboard/audiences",
        "/dashboard/settings",
        "/dashboard/monitors/new",
      ];

      criticalRoutes.forEach((route) => {
        router.prefetch(route);
      });
    }, 1000); // Wait 1 second after mount

    return () => clearTimeout(timer);
  }, [router]);

  return null; // This component doesn't render anything
}
