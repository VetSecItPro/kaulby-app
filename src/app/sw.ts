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

// SW update prompt support: client posts { type: "SKIP_WAITING" } when the user
// taps "Refresh" in the toast — we activate immediately, then the controllerchange
// event in the client triggers a one-shot reload.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | undefined)?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Background Sync: drain the IndexedDB mutation queue when the browser
// fires the 'replay-mutations' tag (after connectivity returns). Each
// mutation is replayed via fetch; idempotent server endpoints make repeat
// replays safe.
//
// Failure handling:
//   - 2xx, 3xx, or 4xx (except 408/429): treat as terminal, remove from queue.
//     4xx is a permanent server-side rejection — looping won't help.
//   - 408/429/5xx/network error: re-throw so the browser retries the sync
//     event later with backoff. Mutation stays in the queue.
//
// IDB constants must mirror lib/offline-queue.ts.
const OQ_DB = "kaulby-offline-queue";
const OQ_STORE = "mutations";
const OQ_VERSION = 1;

interface QueuedMutationSW {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  createdAt: number;
}

function oqOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OQ_DB, OQ_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OQ_STORE)) {
        const store = db.createObjectStore(OQ_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function oqAll(db: IDBDatabase): Promise<QueuedMutationSW[]> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(OQ_STORE, "readonly");
    const req = t.objectStore(OQ_STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedMutationSW[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

function oqDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(OQ_STORE, "readwrite");
    const req = t.objectStore(OQ_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function replayQueuedMutations(): Promise<void> {
  const db = await oqOpen();
  try {
    const items = (await oqAll(db)).sort((a, b) => a.createdAt - b.createdAt);
    for (const m of items) {
      const res = await fetch(m.url, {
        method: m.method,
        headers: m.headers,
        body: m.body ?? undefined,
        credentials: "include",
      });
      const transient = res.status === 408 || res.status === 429 || (res.status >= 500 && res.status < 600);
      if (transient) {
        // Re-throw to signal the browser this sync failed; it'll retry later.
        throw new Error(`Transient ${res.status} replaying ${m.url}`);
      }
      // 2xx / 3xx / 4xx (non-transient) → remove. 4xx is a permanent server
      // rejection (validation, auth) — looping won't help; surface via logs.
      await oqDelete(db, m.id);
    }
  } finally {
    db.close();
  }
}

(self.addEventListener as (type: string, listener: (event: Event & { tag?: string; waitUntil: (p: Promise<unknown>) => void }) => void) => void)(
  "sync",
  (event) => {
    if (event.tag !== "replay-mutations") return;
    event.waitUntil(replayQueuedMutations());
  },
);

// Periodic Background Sync: when the browser fires the 'refresh-dashboard' tag
// (cadence chosen by browser based on user engagement, ~1×/day for active
// users), revalidate the dashboard shell + recent results. This pre-warms
// the SWR cache so opening the app feels instant after a long absence.
// Limited support (Chrome on Android only); no-op silently elsewhere.
// 'periodicsync' isn't in the standard ServiceWorkerGlobalScopeEventMap yet —
// addEventListener is cast to bypass the strict typing.
(self.addEventListener as (type: string, listener: (event: Event & { tag?: string; waitUntil: (p: Promise<unknown>) => void }) => void) => void)(
  "periodicsync",
  (event) => {
    if (event.tag !== "refresh-dashboard") return;
    event.waitUntil(
      (async () => {
        try {
          await fetch("/dashboard", { credentials: "include", cache: "reload" });
          await fetch("/api/aggregations", { credentials: "include", cache: "reload" }).catch(() => undefined);
        } catch {
          // Network errors during background sync are non-fatal — try again next tick.
        }
      })(),
    );
  },
);

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
  const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "kaulby",
    data: { url: data.url || "/dashboard" },
    // Action buttons (Chrome/Edge/Android only — iOS Safari ignores them).
    // 'view' opens the URL like a normal click; 'mark-read' dismisses without
    // opening a tab, hitting the API in the background.
    actions: [
      { action: "view", title: "View" },
      { action: "mark-read", title: "Mark read" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click handler — focus an existing tab if one is open at the target URL,
// otherwise open a new one. The 'mark-read' action stays in the SW: hits the
// API and closes the notification without opening any window.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data?.url as string | undefined) || "/dashboard";

  if (event.action === "mark-read") {
    event.waitUntil(
      fetch("/api/notifications/mark-read-from-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, tag: event.notification.tag }),
        credentials: "include",
      }).catch(() => {
        // Silent fail — user closed the notification, no UI feedback channel.
      }),
    );
    return;
  }

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
