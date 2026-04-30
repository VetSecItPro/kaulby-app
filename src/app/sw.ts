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
