"use client";

// SW update prompt: when a new service worker installs in the background,
// show a non-blocking toast with a "Refresh" action that activates the new
// SW (postMessage SKIP_WAITING) and reloads the page. Without this, users
// stay on stale shells indefinitely until they happen to do a full reload.
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function ServiceWorkerUpdater() {
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    function notifyUserOfUpdate(reg: ServiceWorkerRegistration) {
      const waiting = reg.waiting;
      if (!waiting || cancelled) return;
      toast("New version available", {
        description: "Refresh to load the latest UI.",
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => {
            waiting.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    }

    navigator.serviceWorker.ready
      .then((reg) => {
        // SW already waiting at startup (user opened a tab while a new SW
        // was already installed but not activated).
        if (reg.waiting) notifyUserOfUpdate(reg);

        // Watch future install events.
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              notifyUserOfUpdate(reg);
            }
          });
        });
      })
      .catch(() => {
        // SW registration not yet ready — that's fine, this updater is best-effort.
      });

    // Reload once when the new SW takes control. Guarded so multiple
    // controllerchange events from the same activation don't loop-reload.
    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
