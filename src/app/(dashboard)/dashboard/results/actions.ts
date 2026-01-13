"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { results, monitors } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function verifyResultOwnership(resultId: string, userId: string): Promise<boolean> {
  // Get result and check if user owns the monitor
  const result = await db.query.results.findFirst({
    where: eq(results.id, resultId),
    with: { monitor: true },
  });

  if (!result || !result.monitor) return false;
  return result.monitor.userId === userId;
}

export async function markResultViewed(resultId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const isOwner = await verifyResultOwnership(resultId, userId);
  if (!isOwner) throw new Error("Not found");

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
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const isOwner = await verifyResultOwnership(resultId, userId);
  if (!isOwner) throw new Error("Not found");

  await db
    .update(results)
    .set({
      isClicked: true,
      clickedAt: new Date(),
      // Also mark as viewed if clicking through
      isViewed: true,
      viewedAt: new Date(),
    })
    .where(eq(results.id, resultId));

  revalidatePath("/dashboard/results");
  return { success: true };
}

export async function toggleResultSaved(resultId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const isOwner = await verifyResultOwnership(resultId, userId);
  if (!isOwner) throw new Error("Not found");

  const result = await db.query.results.findFirst({
    where: eq(results.id, resultId),
    columns: { isSaved: true },
  });

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
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const isOwner = await verifyResultOwnership(resultId, userId);
  if (!isOwner) throw new Error("Not found");

  const result = await db.query.results.findFirst({
    where: eq(results.id, resultId),
    columns: { isHidden: true },
  });

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
  const { userId } = await auth();
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
