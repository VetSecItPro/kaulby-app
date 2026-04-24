#!/usr/bin/env tsx
/**
 * Test inserting a Reddit result directly for the zoom-b2b test monitor.
 * Isolates whether DB insert is the failure point.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { and, like, eq, desc } from "drizzle-orm";

async function main() {
  // Find the most recent active zoom-b2b test monitor
  const [mon] = await db
    .select()
    .from(monitors)
    .where(eq(monitors.name, "[PLATFORM-TEST] zoom-b2b"))
    .orderBy(desc(monitors.createdAt))
    .limit(1);

  if (!mon) {
    console.log("no active zoom-b2b test monitor");
    return;
  }
  console.log("monitor:", mon.id, mon.name);

  try {
    const [row] = await db
      .insert(results)
      .values({
        monitorId: mon.id,
        platform: "reddit",
        sourceUrl: `https://reddit.com/r/Zoom/comments/debug-${Date.now()}`,
        title: "DEBUG: direct reddit insert",
        content: "test zoom video",
        author: "debug",
        postedAt: new Date(),
        metadata: { subreddit: "Zoom", score: 1, numComments: 0, source: "debug" },
      })
      .returning();
    console.log("inserted ok:", row.id);
  } catch (e: unknown) {
    console.error("INSERT FAILED:", e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack.slice(0, 1000));
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
