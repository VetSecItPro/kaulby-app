"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-detect and save user's timezone on first visit
 * Uses browser's Intl API to get IANA timezone string
 * Only updates if user hasn't set a timezone manually
 */
export function useAutoTimezone() {
  const hasRun = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (hasRun.current) return;
    hasRun.current = true;

    // Check if we've already auto-detected (localStorage flag)
    const hasAutoDetected = localStorage.getItem("kaulby_tz_auto_detected");
    if (hasAutoDetected) return;

    // Get browser timezone
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimezone) return;

    // Send to API
    fetch("/api/user/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: browserTimezone }),
    })
      .then((res) => {
        if (res.ok) {
          // Mark as auto-detected so we don't override manual changes
          localStorage.setItem("kaulby_tz_auto_detected", "true");
        }
      })
      .catch(() => {
        // Silently fail - timezone is not critical
      });
  }, []);
}
