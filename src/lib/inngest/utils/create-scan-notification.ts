/**
 * Create in-app notifications when scans find new results.
 * Called from monitor scan functions after saving results.
 */
import { pooledDb } from "@/lib/db";
import { notifications, monitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPlatformDisplayName } from "@/lib/platform-utils";

export async function createScanNotification({
  monitorId,
  userId,
  platform,
  resultCount,
}: {
  monitorId: string;
  userId: string;
  platform: string;
  resultCount: number;
}): Promise<void> {
  if (resultCount === 0) return;

  try {
    // Get monitor name for a more useful notification
    const monitor = await pooledDb.query.monitors.findFirst({
      where: eq(monitors.id, monitorId),
      columns: { name: true },
    });

    const monitorName = monitor?.name || "your monitor";
    const platformName = getPlatformDisplayName(platform);

    await pooledDb.insert(notifications).values({
      userId,
      title: `${resultCount} new ${resultCount === 1 ? "mention" : "mentions"} found`,
      message: `${platformName} scan for "${monitorName}" found ${resultCount} new ${resultCount === 1 ? "result" : "results"}.`,
      type: "alert",
      monitorId,
    });
  } catch (err) {
    // Don't let notification failure break the scan pipeline
    console.warn("[notification] Failed to create scan notification:", err);
  }
}
