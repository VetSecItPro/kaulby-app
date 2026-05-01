"use client";

// Sync the OS app-icon badge with the user's unread mention count.
// - Polls /api/notifications/unread-count every 60s while the tab is visible
// - Calls navigator.setAppBadge(count) when count > 0
// - Calls clearAppBadge() when count === 0
// Browser support: Chrome/Edge (desktop + Android), Safari iOS 16.4+. Falls
// back silently on Firefox.
//
// Also updates immediately after the SW receives a push (via BroadcastChannel)
// so the badge appears the instant a new lead lands, not 60s later.
import { useEffect } from "react";

const POLL_INTERVAL_MS = 60_000;
const ENDPOINT = "/api/notifications/unread-count";

async function syncBadge() {
  if (typeof window === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge) return;

  try {
    const res = await fetch(ENDPOINT, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { count?: number };
    const count = Math.max(0, Math.floor(data.count ?? 0));
    if (count > 0) {
      await nav.setAppBadge(count);
    } else {
      await nav.clearAppBadge?.();
    }
  } catch {
    // Network/permission errors are non-fatal — badge just stays as-is.
  }
}

// Best-effort: register the 'refresh-dashboard' Periodic Background Sync tag.
// Browser may grant or silently deny based on engagement / permissions.
// Only Chrome on Android implements this API at all today.
async function registerPeriodicSync() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const periodicSync = (reg as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    }).periodicSync;
    if (!periodicSync) return;
    await periodicSync.register("refresh-dashboard", {
      minInterval: 4 * 60 * 60 * 1000, // hint: at least 4h between fires
    });
  } catch {
    // Permission denied / unsupported — safe to ignore.
  }
}

export function AppBadgeSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void> };

    // Periodic Sync registration is independent of badge support — try once on mount.
    registerPeriodicSync();

    if (!nav.setAppBadge) return;

    syncBadge();
    let intervalId: number | null = window.setInterval(syncBadge, POLL_INTERVAL_MS);

    // Pause polling when tab hidden, resume on reveal.
    const onVisibility = () => {
      if (document.hidden) {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        syncBadge();
        if (intervalId === null) intervalId = window.setInterval(syncBadge, POLL_INTERVAL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
