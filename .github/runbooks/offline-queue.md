# Offline Mutation Queue (Background Sync)

**Status: foundation shipped (PR #363, task #172) + result-card call sites wired (PR #364, task #176). Both tasks closed.**

This runbook explains what the queue does, what's required to use it, and how to wire a real call site safely.

---

## What it is

A client-side IndexedDB queue + service-worker drain handler that lets `fetch()` calls survive transient network failures. The user taps "Bookmark" while on a flaky train Wi-Fi → the request is queued in IDB → the OS replays it via Background Sync the moment connectivity returns.

The user sees no broken state: the UI updates optimistically (synthetic 202 response), the server eventually receives the write, and the row appears in the next reload.

## What's shipped

| Artifact | Path | Purpose |
|---|---|---|
| Library | `src/lib/offline-queue.ts` | `fetchOrQueue(url, init)` wrapper + IDB helpers |
| SW handler | `src/app/sw.ts` (sync event) | Drains queue when browser fires `replay-mutations` tag |
| IDB | `kaulby-offline-queue` / `mutations` | Stored client-side per origin |
| Sync tag | `replay-mutations` | Registered on every queue write |

## Wired call sites (as of #364)

`src/components/dashboard/result-card.tsx` — three actions on every result card now go through the queue:

| Action | Endpoint | Body | Replay-safe |
|---|---|---|---|
| Mark read | `POST /api/results/[id]/mark-read` | `{}` | Yes — sets `isViewed=true` (no toggle) |
| Save / Unsave | `POST /api/results/[id]/save` | `{ saved: bool }` | Yes — explicit boolean, no flip |
| Hide / Unhide | `POST /api/results/[id]/hide` | `{ hidden: bool }` | Yes — explicit boolean, no flip |

UI updates optimistically the moment the user taps; if `fetch` returns a non-202 server error, the optimistic state is rolled back (see `handleToggleSaved` / `handleToggleHidden` in result-card.tsx).

The legacy server actions (`toggleResultSaved`, `toggleResultHidden`, `markResultViewed`) still exist in `src/app/(dashboard)/dashboard/results/actions.ts` for any non-UI consumer (Inngest jobs, scripts) but are no longer called from the result-card.

## How to wire additional call sites

For any new mutation, two paths:

### Path A — Refactor server actions to fetch
The current `result-card` bookmark UI calls `toggleResultSaved()` (a Next.js server action). Server actions use a separate RPC transport that `fetchOrQueue` cannot wrap. To use the queue, convert the call site:

**Before:**
```tsx
import { toggleResultSaved } from "./actions";
// ...
const result = await toggleResultSaved(resultId);
```

**After:**
```tsx
import { fetchOrQueue } from "@/lib/offline-queue";
// ...
const res = await fetchOrQueue(`/api/results/${resultId}/save`, {
  method: "POST",
  body: JSON.stringify({ saved: !isSaved }),
});
const result = await res.json();
// res.status === 202 means queued — UI should show optimistic state
```

This requires:
1. Building the `POST /api/results/[id]/save` endpoint (idempotent: SET saved=X)
2. Removing the equivalent server action (or keeping both for SSR fallback)
3. Adding optimistic UI state handling (treat 202 as "pending sync")

### Path B — Add Idempotency-Key infrastructure
Some endpoints (`POST /api/bookmarks/collections`) create new rows non-idempotently. A naive replay would create duplicates. To make these queue-safe:

1. Client generates `crypto.randomUUID()` per logical operation, sends as `Idempotency-Key` header
2. Server stores `(user_id, idempotency_key) → response` in a dedup table for ~24h
3. On replay, server returns the cached response instead of re-executing

This is more work but unlocks the queue for any mutation, not just naturally-idempotent ones.

**Recommended:** start with Path A on the bookmark + mark-read flows (the two most common offline-prone actions on mobile). Defer Path B until a third use case justifies the dedup table.

## Server-side rule

> **Endpoints replayed by the queue MUST be idempotent.**

Naturally idempotent today:
- `POST /api/bookmarks` — find-or-update on (user_id, result_id)
- `POST /api/push/subscribe` — upsert on endpoint
- `DELETE /api/bookmarks/[resultId]` — delete-if-exists

NOT idempotent (do not route through queue without Path B):
- `POST /api/bookmarks/collections` — creates new row each call
- `POST /api/monitors` — creates new monitor each call
- `POST /api/audiences` — creates new audience each call

## How the drain works

1. Browser fires `sync` event with tag `replay-mutations` after connectivity returns
2. SW opens IDB, sorts queue oldest-first (preserves causal order)
3. For each entry: `fetch(url, { method, headers, body, credentials: include })`
4. Outcome:
   - **2xx, 3xx, 4xx (except 408/429):** remove from queue. 4xx is permanent (validation, auth) — looping won't help.
   - **408, 429, 5xx, network error:** re-throw. Browser retries the sync event later with backoff. Mutation stays in queue.
5. If the entire drain fails at any point, browser reschedules a future sync.

## How to test locally

1. Run `pnpm dev`
2. Open DevTools → Application → Service Workers; verify the SW is active
3. Open DevTools → Application → IndexedDB; expand `kaulby-offline-queue` → `mutations` (will be empty)
4. In the console (after a call site is wired):
   ```js
   // Simulate offline by stopping the dev server
   // Trigger the wired action (e.g., bookmark a result)
   // Observe the entry appear in IDB
   // Restart the dev server
   // Observe the entry drained within seconds
   ```
5. To force the SW to fire `sync` immediately: DevTools → Application → Service Workers → "Sync" tag input → enter `replay-mutations` → "Sync"

## Browser support

| Browser | Background Sync | Behavior |
|---|---|---|
| Chrome desktop / Android | ✅ Full support | Queue + auto-replay |
| Edge desktop | ✅ Full support | Queue + auto-replay |
| Firefox | ❌ Not implemented | Falls back to immediate fetch retry on next user action; entries written to IDB drain on the next online `sync` attempt initiated by user activity |
| Safari (macOS, iOS) | ❌ Not implemented | Same fallback as Firefox |

The library never crashes on unsupported browsers — `sync.register` is a no-op if absent. The drain still works the next time the SW gets a chance to run, just not autonomously in the background.

## Failure modes to watch for

1. **Permanent 4xx loops** — if the server returns 400 (validation) repeatedly for a queued entry, the SW removes it on first attempt. Logged but no user notification. Consider surfacing a toast for important mutations.
2. **IDB quota exhaustion** — extremely unlikely (each entry is <1KB), but the lib doesn't currently cap queue size. If a user goes offline for a week with thousands of bookmark toggles, the IDB could grow. Future work: cap at 1000 entries, drop oldest on overflow.
3. **Server action drift** — if a wired endpoint stops being idempotent (e.g., someone removes the find-or-update), replay creates duplicates silently. Mitigation: PR review checklist + integration test that replays a mutation twice and asserts single row.

## Spawned tasks

- **#176** — Wire offline-queue to bookmark + mark-read call sites. Decide Path A vs Path B first.
