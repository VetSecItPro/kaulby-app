"use server";

import { getEffectiveUserId } from "@/lib/dev-auth";
import { db } from "@/lib/db";
import { results, monitors, savedViews } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics";
import { checkApiRateLimit } from "@/lib/rate-limit";

// Task 2.2: Bulk actions + Saved Views. The user-facing promise is "triage 50
// results in under a minute" — so every batch action is a single UPDATE
// scoped to ids the caller owns (verified via a monitor join), and both the
// list of ids and the saved-view name are length-capped to keep the write
// predictable under rate limit.
const MAX_BATCH_SIZE = 200;
const MAX_VIEW_NAME_LENGTH = 100;
const MAX_SAVED_VIEWS_PER_USER = 50;

type SavedViewFilters = {
  categoryFilter?: string | null;
  sentimentFilter?: string | null;
  platformFilter?: string | null;
  statusFilter?: "all" | "unread" | "saved" | "hidden";
  leadScoreMin?: number | null;
};

/**
 * Fetch the subset of `ids` whose owning monitor belongs to `userId`.
 * This is the authorization guard for every batch action — we only write to
 * result rows the caller provably owns, even if the caller sends a mixed list.
 */
async function filterOwnedResultIds(
  ids: string[],
  userId: string
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: results.id })
    .from(results)
    .innerJoin(monitors, eq(results.monitorId, monitors.id))
    .where(and(inArray(results.id, ids), eq(monitors.userId, userId)));
  return rows.map((r) => r.id);
}

async function assertAuthedWrite(): Promise<string> {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");
  const { allowed, retryAfter } = await checkApiRateLimit(userId, "write");
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Retry in ${retryAfter ?? 60}s.`);
  }
  return userId;
}

function validateBatchIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) throw new Error("ids must be an array");
  if (ids.length === 0) return [];
  if (ids.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size exceeds max of ${MAX_BATCH_SIZE}`);
  }
  const valid = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  return valid;
}

// PERF-REDUN-001: Single query to verify ownership AND fetch needed fields
async function getOwnedResult(resultId: string, userId: string) {
  const result = await db.query.results.findFirst({
    where: eq(results.id, resultId),
    with: { monitor: { columns: { userId: true } } },
  });
  if (!result || !result.monitor || result.monitor.userId !== userId) return null;
  return result;
}

export async function markResultViewed(resultId: string) {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");

  const result = await getOwnedResult(resultId, userId);
  if (!result) throw new Error("Not found");

  await db
    .update(results)
    .set({
      isViewed: true,
      viewedAt: new Date(),
    })
    .where(eq(results.id, resultId));

  // Task 1.4: taxonomy event — feeds the "which alerts get acted on?" funnel.
  track("result.action_taken", { userId, resultId, action: "mark_read" });

  revalidatePath("/dashboard/results");
  return { success: true };
}

export async function markResultClicked(resultId: string) {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");

  const result = await getOwnedResult(resultId, userId);
  if (!result) throw new Error("Not found");

  await db
    .update(results)
    .set({
      isClicked: true,
      clickedAt: new Date(),
      isViewed: true,
      viewedAt: new Date(),
    })
    .where(eq(results.id, resultId));

  revalidatePath("/dashboard/results");
  return { success: true };
}

export async function toggleResultSaved(resultId: string) {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");

  const result = await getOwnedResult(resultId, userId);
  if (!result) throw new Error("Not found");

  const newSaved = !result.isSaved;
  await db
    .update(results)
    .set({
      isSaved: newSaved,
    })
    .where(eq(results.id, resultId));

  // Task 1.4: differentiate save vs unsave so retention funnels don't
  // conflate them.
  track("result.action_taken", {
    userId,
    resultId,
    action: newSaved ? "save" : "unsave",
  });

  revalidatePath("/dashboard/results");
  return { success: true, isSaved: newSaved };
}

export async function toggleResultHidden(resultId: string) {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");

  const result = await getOwnedResult(resultId, userId);
  if (!result) throw new Error("Not found");

  const newHidden = !result.isHidden;
  await db
    .update(results)
    .set({
      isHidden: newHidden,
    })
    .where(eq(results.id, resultId));

  // Task 1.4: only fire on hide (not un-hide) — the un-hide case is rare and
  // doesn't carry signal about which results users find noisy.
  if (newHidden) {
    track("result.action_taken", { userId, resultId, action: "hide" });
  }

  revalidatePath("/dashboard/results");
  return { success: true, isHidden: newHidden };
}

export async function markAllResultsViewed() {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");

  // Get user's monitors
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true },
  });

  const monitorIds = userMonitors.map((m) => m.id);

  if (monitorIds.length > 0) {
    await db
      .update(results)
      .set({
        isViewed: true,
        viewedAt: new Date(),
      })
      .where(
        and(
          inArray(results.monitorId, monitorIds),
          eq(results.isViewed, false)
        )
      );
  }

  revalidatePath("/dashboard/results");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Task 2.2: Bulk actions
// ---------------------------------------------------------------------------

export async function batchMarkResultsRead(ids: string[]) {
  const userId = await assertAuthedWrite();
  const validated = validateBatchIds(ids);
  const owned = await filterOwnedResultIds(validated, userId);
  if (owned.length === 0) return { success: true, updated: 0 };

  await db
    .update(results)
    .set({ isViewed: true, viewedAt: new Date() })
    .where(inArray(results.id, owned));

  revalidatePath("/dashboard/results");
  return { success: true, updated: owned.length };
}

export async function batchHideResults(ids: string[]) {
  const userId = await assertAuthedWrite();
  const validated = validateBatchIds(ids);
  const owned = await filterOwnedResultIds(validated, userId);
  if (owned.length === 0) return { success: true, updated: 0 };

  await db
    .update(results)
    .set({ isHidden: true })
    .where(inArray(results.id, owned));

  revalidatePath("/dashboard/results");
  return { success: true, updated: owned.length };
}

export async function batchUnhideResults(ids: string[]) {
  const userId = await assertAuthedWrite();
  const validated = validateBatchIds(ids);
  const owned = await filterOwnedResultIds(validated, userId);
  if (owned.length === 0) return { success: true, updated: 0 };

  await db
    .update(results)
    .set({ isHidden: false })
    .where(inArray(results.id, owned));

  revalidatePath("/dashboard/results");
  return { success: true, updated: owned.length };
}

export async function batchSaveResults(ids: string[]) {
  const userId = await assertAuthedWrite();
  const validated = validateBatchIds(ids);
  const owned = await filterOwnedResultIds(validated, userId);
  if (owned.length === 0) return { success: true, updated: 0 };

  await db
    .update(results)
    .set({ isSaved: true })
    .where(inArray(results.id, owned));

  revalidatePath("/dashboard/results");
  return { success: true, updated: owned.length };
}

export async function batchUnsaveResults(ids: string[]) {
  const userId = await assertAuthedWrite();
  const validated = validateBatchIds(ids);
  const owned = await filterOwnedResultIds(validated, userId);
  if (owned.length === 0) return { success: true, updated: 0 };

  await db
    .update(results)
    .set({ isSaved: false })
    .where(inArray(results.id, owned));

  revalidatePath("/dashboard/results");
  return { success: true, updated: owned.length };
}

// ---------------------------------------------------------------------------
// Task 2.2: Saved Views
// ---------------------------------------------------------------------------

export async function createSavedView(name: string, filters: SavedViewFilters) {
  const userId = await assertAuthedWrite();

  if (typeof name !== "string") throw new Error("Name must be a string");
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Name is required");
  if (trimmed.length > MAX_VIEW_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_VIEW_NAME_LENGTH} characters`);
  }

  // Cap total saved views per user to prevent abuse / accidental fill.
  const existing = await db
    .select({ id: savedViews.id })
    .from(savedViews)
    .where(eq(savedViews.userId, userId));
  if (existing.length >= MAX_SAVED_VIEWS_PER_USER) {
    throw new Error(`Cannot create more than ${MAX_SAVED_VIEWS_PER_USER} saved views`);
  }

  const [inserted] = await db
    .insert(savedViews)
    .values({ userId, name: trimmed, filters })
    .returning();

  revalidatePath("/dashboard/results");
  return { success: true, view: inserted };
}

export async function listSavedViews() {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");

  const views = await db
    .select()
    .from(savedViews)
    .where(eq(savedViews.userId, userId))
    .orderBy(desc(savedViews.updatedAt));

  return { success: true, views };
}

export async function deleteSavedView(id: string) {
  const userId = await assertAuthedWrite();
  if (typeof id !== "string" || id.length === 0) throw new Error("Invalid id");

  const deleted = await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)))
    .returning({ id: savedViews.id });

  if (deleted.length === 0) throw new Error("Not found");

  revalidatePath("/dashboard/results");
  return { success: true };
}
