import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Kaulby-shaped caching strategies, layered ON TOP of Serwist's defaultCache
// (which still handles fonts, images, generic assets). Order matters — first
// matching matcher wins, so put narrow matchers first.
const kaulbyRuntimeCaching: RuntimeCaching[] = [
  // Public API (v1): live data must be fresh, fall back to cache when offline.
  {
    matcher: ({ url }) => url.pathname.startsWith("/api/v1/"),
    handler: new NetworkFirst({
      cacheName: "kaulby-api-v1",
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 60 * 60, // 1h
        }),
      ],
    }),
  },
  // Internal API (dashboard reads): same network-first pattern; never serve
  // stale auth/state. Mutating verbs (POST/PUT/PATCH/DELETE) bypass the SW.
  {
    matcher: ({ url, request }) =>
      url.pathname.startsWith("/api/") && request.method === "GET",
    handler: new NetworkFirst({
      cacheName: "kaulby-api-internal",
      networkTimeoutSeconds: 4,
      plugins: [
        new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 }),
      ],
    }),
  },
  // Dashboard shells: instant render from cache, refresh in background.
  {
    matcher: ({ url, request }) =>
      url.pathname.startsWith("/dashboard") && request.destination === "document",
    handler: new StaleWhileRevalidate({
      cacheName: "kaulby-dashboard-shells",
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
      ],
    }),
  },
  // Static images & icons we ship in /public — already immutable, cache hard.
  {
    matcher: ({ url }) =>
      url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/screenshots/") ||
      url.pathname === "/icon-192.png" ||
      url.pathname === "/icon-512.png" ||
      url.pathname === "/apple-touch-icon.png",
    handler: new CacheFirst({
      cacheName: "kaulby-static-images",
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...kaulbyRuntimeCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// ---------------------------------------------------------------------------
// Web Push handlers
// ---------------------------------------------------------------------------
// Server sends payloads via web-push (lib/push.ts). Each payload is a JSON
// object: { title, body, url?, tag?, icon? }. Empty/malformed pushes still
// show a generic notification so the OS doesn't ignore the wakeup.
self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string; icon?: string } = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Kaulby", body: event.data.text() };
    }
  }
  const title = data.title || "Kaulby";
  const options: NotificationOptions = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "kaulby",
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click handler — focus an existing tab if one is open at the target URL,
// otherwise open a new one. Avoids spawning a new tab on every notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data?.url as string | undefined) || "/dashboard";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        // Same-origin tab already open — focus it and navigate.
        if ("focus" in client) {
          await (client as WindowClient).focus();
          if ("navigate" in client) {
            try {
              await (client as WindowClient).navigate(target);
            } catch {
              // navigate() can throw if the target is cross-origin — fall back to open.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
