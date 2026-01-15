"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register in production and on supported browsers
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    // Register after page load to not block rendering
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Check for updates periodically
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New version available - could show update prompt
                console.log("[SW] New version available");
              }
            });
          }
        });
      } catch (error) {
        console.warn("[SW] Registration failed:", error);
      }
    };

    // Delay registration to prioritize main content
    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback(registerSW, { timeout: 5000 });
    } else {
      setTimeout(registerSW, 3000);
    }
  }, []);

  return null;
}
