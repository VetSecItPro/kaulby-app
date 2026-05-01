// Offline mutation queue (Background Sync)
//
// Wraps fetch() so a write that fails due to network can be queued in IndexedDB
// and replayed by the service worker via the Background Sync API. Used for
// commute / spotty-network scenarios where the user taps Bookmark / Mark Read
// while offline — the action feels instant and persists when connectivity
// returns. NOT used for reads; reads degrade gracefully on their own.
//
// Server side: every replayed endpoint MUST be idempotent. Bookmark create
// is already (find-or-update + ON CONFLICT). When wiring a new mutation,
// confirm idempotency before pointing it at this queue.
//
// Browser support: Background Sync is Chrome/Edge/Android. Firefox + Safari
// fall back to immediate retry (or surface an error to caller). Either way
// the user sees no broken state — they just don't get the resilient queue
// behavior on those browsers.

const DB_NAME = "kaulby-offline-queue";
const DB_VERSION = 1;
const STORE = "mutations";
const SYNC_TAG = "replay-mutations";

export interface QueuedMutation {
  id: string;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body: string | null; // JSON-stringified
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function enqueue(mutation: QueuedMutation): Promise<void> {
  await tx("readwrite", (s) => s.put(mutation));
  // Best-effort: register the sync tag so the SW knows there's work waiting.
  // If unsupported (Firefox/Safari) the tag is a no-op; the immediate retry
  // path still applies on the next user action.
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sync = (reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }).sync;
      await sync?.register(SYNC_TAG);
    } catch {
      // No-op on unsupported / permission-denied browsers.
    }
  }
}

export async function listQueued(): Promise<QueuedMutation[]> {
  const all = await tx<QueuedMutation[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedMutation[]>);
  // Oldest first — preserves causal order for the user.
  return [...all].sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function count(): Promise<number> {
  return tx<number>("readonly", (s) => s.count() as IDBRequest<number>);
}

// Public API: try fetch normally; on network failure, queue + return synthetic
// 202 Accepted so the caller can update UI optimistically.
//
// On HTTP errors (4xx/5xx) we DO NOT queue — those are server-side failures
// the caller should handle (display validation error, surface 401, etc.).
// Only true network/transport failures result in queueing.
export async function fetchOrQueue(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<Response> {
  const method = (init.method || "POST").toUpperCase() as QueuedMutation["method"];
  const headers = init.headers || {};
  const body = init.body ?? null;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body,
      credentials: "include",
    });
    return res;
  } catch (err) {
    // Network failure (offline, DNS, connection reset). Queue for replay.
    if (typeof crypto === "undefined" || !("randomUUID" in crypto)) {
      // No queue support without crypto.randomUUID — re-throw so caller can react.
      throw err;
    }
    const id = (crypto as { randomUUID: () => string }).randomUUID();
    await enqueue({
      id,
      url,
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body,
      createdAt: Date.now(),
    });
    // Synthetic Accepted response — caller updates UI optimistically. The SW
    // will replay when connectivity returns; backend is idempotent so a later
    // replay is safe even if the user repeated the action online.
    return new Response(JSON.stringify({ queued: true, id }), {
      status: 202,
      headers: { "Content-Type": "application/json", "X-Offline-Queued": id },
    });
  }
}
