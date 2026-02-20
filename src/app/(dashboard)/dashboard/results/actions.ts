"use server";

import { getEffectiveUserId } from "@/lib/dev-auth";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

  await db
    .update(results)
    .set({
      isSaved: !result.isSaved,
    })
    .where(eq(results.id, resultId));

  revalidatePath("/dashboard/results");
  return { success: true, isSaved: !result.isSaved };
}

export async function toggleResultHidden(resultId: string) {
  const userId = await getEffectiveUserId();
  if (!userId) throw new Error("Unauthorized");

  const result = await getOwnedResult(resultId, userId);
  if (!result) throw new Error("Not found");

  await db
    .update(results)
    .set({
      isHidden: !result.isHidden,
    })
    .where(eq(results.id, resultId));

  revalidatePath("/dashboard/results");
  return { success: true, isHidden: !result.isHidden };
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
