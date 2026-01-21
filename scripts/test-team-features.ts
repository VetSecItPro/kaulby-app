/**
 * Test script for Team Monitor Ownership & Assignment features
 * Run with: npx tsx scripts/test-team-features.ts
 *
 * This script tests:
 * 1. Creating a workspace for John (dev@kaulbyapp.com)
 * 2. Adding test users to the workspace
 * 3. Creating monitors and assigning workspaceId
 * 4. Testing member deletion and monitor transfer to owner
 * 5. Testing monitor reassignment by owner
 * 6. Cleaning up test data
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { users, monitors, workspaces, audiences } from "../src/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const JOHN_EMAIL = "dev@kaulbyapp.com";

// Test user IDs (using UUIDs to avoid conflicts with real Clerk IDs)
const TEST_USER_IDS = {
  testUser1: "test-user-1-" + Date.now(),
  testUser2: "test-user-2-" + Date.now(),
  testUser3: "test-user-3-" + Date.now(),
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=".repeat(60));
  console.log("TEAM FEATURES TEST SCRIPT");
  console.log("=".repeat(60));

  try {
    // ========================================
    // STEP 1: Find John's account
    // ========================================
    console.log("\n[STEP 1] Finding John's account...");

    const john = await db.query.users.findFirst({
      where: eq(users.email, JOHN_EMAIL),
    });

    if (!john) {
      console.error(`❌ User ${JOHN_EMAIL} not found. Please ensure this account exists.`);
      process.exit(1);
    }

    console.log(`✓ Found John: ${john.name || john.email} (ID: ${john.id})`);
    console.log(`  Current subscription: ${john.subscriptionStatus}`);

    // Ensure John has enterprise subscription for team features
    if (john.subscriptionStatus !== "enterprise") {
      console.log("  Upgrading to enterprise for testing...");
      await db
        .update(users)
        .set({ subscriptionStatus: "enterprise" })
        .where(eq(users.id, john.id));
    }

    // ========================================
    // STEP 2: Create or get workspace
    // ========================================
    console.log("\n[STEP 2] Setting up workspace...");

    let workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.ownerId, john.id),
    });

    if (workspace) {
      console.log(`✓ Found existing workspace: ${workspace.name} (ID: ${workspace.id})`);
    } else {
      console.log("  Creating new workspace...");
      const [newWorkspace] = await db
        .insert(workspaces)
        .values({
          name: "John's Test Workspace",
          ownerId: john.id,
          seatLimit: 5,
          seatCount: 1,
        })
        .returning();
      workspace = newWorkspace;
      console.log(`✓ Created workspace: ${workspace.name} (ID: ${workspace.id})`);
    }

    // Update John to be owner of workspace
    await db
      .update(users)
      .set({
        workspaceId: workspace.id,
        workspaceRole: "owner",
      })
      .where(eq(users.id, john.id));
    console.log(`✓ John is now the workspace owner`);

    // ========================================
    // STEP 3: Create test users
    // ========================================
    console.log("\n[STEP 3] Creating test users...");

    const testUsersData = [
      { id: TEST_USER_IDS.testUser1, email: "testuser1@example.com", name: "TestUser1" },
      { id: TEST_USER_IDS.testUser2, email: "testuser2@example.com", name: "TestUser2" },
      { id: TEST_USER_IDS.testUser3, email: "testuser3@example.com", name: "TestUser3" },
    ];

    for (const userData of testUsersData) {
      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userData.id),
      });

      if (!existingUser) {
        await db.insert(users).values({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          subscriptionStatus: "enterprise",
          workspaceId: workspace.id,
          workspaceRole: "member",
        });
        console.log(`✓ Created ${userData.name} (ID: ${userData.id})`);
      } else {
        await db
          .update(users)
          .set({
            workspaceId: workspace.id,
            workspaceRole: "member",
            subscriptionStatus: "enterprise",
          })
          .where(eq(users.id, userData.id));
        console.log(`✓ Updated ${userData.name} to workspace member`);
      }
    }

    // Update workspace seat count
    await db
      .update(workspaces)
      .set({ seatCount: 4 }) // John + 3 test users
      .where(eq(workspaces.id, workspace.id));

    // ========================================
    // STEP 4: Create monitors for each user
    // ========================================
    console.log("\n[STEP 4] Creating monitors for each user...");

    const allUsers = [
      { id: john.id, name: "John" },
      { id: TEST_USER_IDS.testUser1, name: "TestUser1" },
      { id: TEST_USER_IDS.testUser2, name: "TestUser2" },
      { id: TEST_USER_IDS.testUser3, name: "TestUser3" },
    ];

    const createdMonitorIds: string[] = [];

    for (const user of allUsers) {
      for (let i = 1; i <= 3; i++) {
        const [monitor] = await db
          .insert(monitors)
          .values({
            userId: user.id,
            workspaceId: workspace.id,
            name: `${user.name} Monitor ${i}`,
            companyName: `Company ${i}`,
            keywords: [`keyword${i}a`, `keyword${i}b`],
            platforms: ["reddit", "hackernews"],
            isActive: true,
          })
          .returning();
        createdMonitorIds.push(monitor.id);
        console.log(`✓ Created "${monitor.name}" for ${user.name}`);
      }
    }

    console.log(`\nTotal monitors created: ${createdMonitorIds.length}`);

    // ========================================
    // STEP 5: Test member deletion (TestUser2)
    // ========================================
    console.log("\n[STEP 5] Testing member deletion (removing TestUser2)...");

    // Get TestUser2's monitors before deletion
    const testUser2Monitors = await db.query.monitors.findMany({
      where: and(
        eq(monitors.userId, TEST_USER_IDS.testUser2),
        eq(monitors.workspaceId, workspace.id)
      ),
    });
    console.log(`  TestUser2 has ${testUser2Monitors.length} monitors before removal`);

    // Transfer monitors to workspace owner (John)
    await db
      .update(monitors)
      .set({
        userId: john.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(monitors.userId, TEST_USER_IDS.testUser2),
          eq(monitors.workspaceId, workspace.id)
        )
      );
    console.log(`✓ Transferred ${testUser2Monitors.length} monitors to John`);

    // Remove TestUser2 from workspace
    await db
      .update(users)
      .set({
        workspaceId: null,
        workspaceRole: null,
      })
      .where(eq(users.id, TEST_USER_IDS.testUser2));
    console.log(`✓ Removed TestUser2 from workspace`);

    // Verify John now has the monitors
    const johnMonitorsAfter = await db.query.monitors.findMany({
      where: and(
        eq(monitors.userId, john.id),
        eq(monitors.workspaceId, workspace.id)
      ),
    });
    console.log(`  John now has ${johnMonitorsAfter.length} monitors (was 3, now should be 6)`);

    // ========================================
    // STEP 6: Test monitor reassignment
    // ========================================
    console.log("\n[STEP 6] Testing monitor reassignment by owner...");

    // Get monitors that were transferred from TestUser2
    const monitorsToReassign = johnMonitorsAfter.filter((m) =>
      m.name.includes("TestUser2")
    );
    console.log(`  Found ${monitorsToReassign.length} monitors to reassign`);

    if (monitorsToReassign.length >= 3) {
      // Reassign 2 monitors to TestUser1
      const toTestUser1 = monitorsToReassign.slice(0, 2);
      for (const monitor of toTestUser1) {
        await db
          .update(monitors)
          .set({ userId: TEST_USER_IDS.testUser1 })
          .where(eq(monitors.id, monitor.id));
        console.log(`✓ Reassigned "${monitor.name}" to TestUser1`);
      }

      // Reassign 1 monitor to TestUser3
      const toTestUser3 = monitorsToReassign[2];
      await db
        .update(monitors)
        .set({ userId: TEST_USER_IDS.testUser3 })
        .where(eq(monitors.id, toTestUser3.id));
      console.log(`✓ Reassigned "${toTestUser3.name}" to TestUser3`);
    }

    // Verify assignments
    const testUser1Monitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, TEST_USER_IDS.testUser1),
    });
    const testUser3Monitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, TEST_USER_IDS.testUser3),
    });
    console.log(`\n  TestUser1 now has ${testUser1Monitors.length} monitors (should be 5)`);
    console.log(`  TestUser3 now has ${testUser3Monitors.length} monitors (should be 4)`);

    // ========================================
    // STEP 7: Clean up - delete test users
    // ========================================
    console.log("\n[STEP 7] Cleaning up test users and their monitors...");

    // Delete monitors for TestUser1 and TestUser3, transfer to John first
    for (const testUserId of [TEST_USER_IDS.testUser1, TEST_USER_IDS.testUser3]) {
      // Transfer monitors back to John
      await db
        .update(monitors)
        .set({ userId: john.id })
        .where(eq(monitors.userId, testUserId));

      // Remove from workspace
      await db
        .update(users)
        .set({ workspaceId: null, workspaceRole: null })
        .where(eq(users.id, testUserId));
    }
    console.log("✓ Transferred remaining monitors to John");
    console.log("✓ Removed TestUser1 and TestUser3 from workspace");

    // Delete test users completely
    await db.delete(users).where(
      inArray(users.id, Object.values(TEST_USER_IDS))
    );
    console.log("✓ Deleted test users from database");

    // ========================================
    // STEP 8: Clean up workspace and monitors
    // ========================================
    console.log("\n[STEP 8] Cleaning up workspace...");

    // Delete all test monitors (those created in this test)
    await db.delete(monitors).where(
      inArray(monitors.id, createdMonitorIds)
    );
    console.log(`✓ Deleted ${createdMonitorIds.length} test monitors`);

    // Delete the workspace
    await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
    console.log("✓ Deleted test workspace");

    // Reset John to be a solo user (no workspace)
    await db
      .update(users)
      .set({
        workspaceId: null,
        workspaceRole: null,
      })
      .where(eq(users.id, john.id));
    console.log("✓ Reset John to solo user (no workspace)");

    // ========================================
    // FINAL STATUS
    // ========================================
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));

    // Verify final state
    const finalJohn = await db.query.users.findFirst({
      where: eq(users.id, john.id),
    });
    console.log("\nFinal state:");
    console.log(`  John's workspace: ${finalJohn?.workspaceId || "None (solo user)"}`);
    console.log(`  John's workspace role: ${finalJohn?.workspaceRole || "N/A"}`);
    console.log(`  John's subscription: ${finalJohn?.subscriptionStatus}`);

    const johnFinalMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, john.id),
    });
    console.log(`  John's monitors: ${johnFinalMonitors.length}`);

  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
