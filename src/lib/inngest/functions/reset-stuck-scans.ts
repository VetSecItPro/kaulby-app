/**
 * Reset Stuck Scans
 *
 * Scheduled function that runs every 5 minutes to find and reset
 * monitors that have been stuck in "scanning" state for more than 10 minutes.
 *
 * This prevents monitors from being permanently stuck if an Inngest
 * function crashes or times out before resetting the isScanning flag.
 */

import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, and, lt } from "drizzle-orm";

// Timeout threshold: 10 minutes
const STUCK_SCAN_THRESHOLD_MS = 10 * 60 * 1000;

export const resetStuckScans = inngest.createFunction(
  {
    id: "reset-stuck-scans",
    name: "Reset Stuck Scans",
    timeouts: { finish: "5m" },
  },
  { cron: "30 */2 * * *" }, // Every 2 hours at :30 (aligned with scan cycle)
  async ({ step }) => {
    const cutoffTime = new Date(Date.now() - STUCK_SCAN_THRESHOLD_MS);

    const result = await step.run("find-and-reset-stuck-scans", async () => {
      // Find monitors that are scanning and haven't been updated in 10+ minutes
      const stuckMonitors = await pooledDb
        .update(monitors)
        .set({
          isScanning: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(monitors.isScanning, true),
            lt(monitors.updatedAt, cutoffTime)
          )
        )
        .returning({ id: monitors.id, name: monitors.name });

      return stuckMonitors;
    });

    if (result.length > 0) {
      logger.info("[reset-stuck-scans] Reset stuck monitors", { count: result.length, monitors: result.map((m) => m.name) });
    }

    return {
      reset: result.length,
      monitors: result.map((m) => m.name),
    };
  }
);
