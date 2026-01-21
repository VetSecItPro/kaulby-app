/**
 * Backfill workspaceId for existing monitors and audiences
 * Run with: npx tsx scripts/backfill-workspace-ids.ts
 *
 * This script sets the workspaceId on monitors/audiences based on their owner's workspace membership.
 * If a user is in a workspace, all their monitors/audiences get that workspaceId.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { users, monitors, audiences } from "../src/lib/db/schema";
import { eq, isNotNull, isNull, and } from "drizzle-orm";

async function backfillWorkspaceIds() {
  console.log("Starting workspace ID backfill...\n");

  // Get all users who are in a workspace
  const workspaceUsers = await db.query.users.findMany({
    where: isNotNull(users.workspaceId),
  });

  console.log(`Found ${workspaceUsers.length} users in workspaces\n`);

  let monitorsUpdated = 0;
  let audiencesUpdated = 0;

  for (const user of workspaceUsers) {
    if (!user.workspaceId) continue;

    // Update monitors that don't have a workspaceId yet
    const monitorResult = await db
      .update(monitors)
      .set({
        workspaceId: user.workspaceId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(monitors.userId, user.id),
          isNull(monitors.workspaceId)
        )
      );

    // Update audiences that don't have a workspaceId yet
    const audienceResult = await db
      .update(audiences)
      .set({
        workspaceId: user.workspaceId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(audiences.userId, user.id),
          isNull(audiences.workspaceId)
        )
      );

    // Note: Drizzle doesn't return affected row count directly, so we'll count manually
    const userMonitors = await db.query.monitors.findMany({
      where: and(
        eq(monitors.userId, user.id),
        eq(monitors.workspaceId, user.workspaceId)
      ),
    });

    const userAudiences = await db.query.audiences.findMany({
      where: and(
        eq(audiences.userId, user.id),
        eq(audiences.workspaceId, user.workspaceId)
      ),
    });

    if (userMonitors.length > 0 || userAudiences.length > 0) {
      console.log(`User ${user.email}:`);
      console.log(`  - Monitors with workspaceId: ${userMonitors.length}`);
      console.log(`  - Audiences with workspaceId: ${userAudiences.length}`);
    }

    monitorsUpdated += userMonitors.length;
    audiencesUpdated += userAudiences.length;
  }

  console.log("\n--- Summary ---");
  console.log(`Total monitors with workspaceId: ${monitorsUpdated}`);
  console.log(`Total audiences with workspaceId: ${audiencesUpdated}`);
  console.log("\nBackfill complete!");
}

backfillWorkspaceIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
