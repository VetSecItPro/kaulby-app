/**
 * Seed an admin user into the E2E database so the dev-auth bypass
 * (src/lib/dev-auth.ts) can resolve a user in CI Playwright runs.
 *
 * Idempotent: upserts by deterministic id `e2e-admin-user`. Safe to run
 * repeatedly, safe to run in GitHub Actions before the e2e job.
 *
 * Run locally:  pnpm exec tsx scripts/seed-e2e-admin.ts
 * Run in CI:    `DATABASE_URL` must point at the E2E Neon branch.
 *
 * IMPORTANT: never run against production. The script refuses to run
 * without `ALLOW_DEV_AUTH_BYPASS=true` or `CI=true`, and refuses when it
 * detects a Vercel env. That mirrors the dev-auth bypass guard so this
 * file can't silently create a backdoor admin in prod.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const E2E_ADMIN_ID = "e2e-admin-user";
const E2E_ADMIN_EMAIL = "e2e-admin@kaulby.test";

async function main() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    console.error("[seed-e2e-admin] Refusing to run on Vercel.");
    process.exit(1);
  }
  if (
    process.env.ALLOW_DEV_AUTH_BYPASS !== "true" &&
    process.env.CI !== "true" &&
    process.env.GITHUB_ACTIONS !== "true"
  ) {
    console.error(
      "[seed-e2e-admin] Refusing: set ALLOW_DEV_AUTH_BYPASS=true or run in CI."
    );
    process.exit(1);
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, E2E_ADMIN_ID),
    columns: { id: true, isAdmin: true },
  });

  if (existing) {
    if (!existing.isAdmin) {
      await db
        .update(users)
        .set({ isAdmin: true, onboardingCompleted: true })
        .where(eq(users.id, E2E_ADMIN_ID));
      console.log(`[seed-e2e-admin] Promoted existing user ${E2E_ADMIN_ID} to admin.`);
    } else {
      console.log(`[seed-e2e-admin] Admin ${E2E_ADMIN_ID} already exists, no-op.`);
    }
    return;
  }

  await db.insert(users).values({
    id: E2E_ADMIN_ID,
    email: E2E_ADMIN_EMAIL,
    name: "E2E Admin",
    isAdmin: true,
    onboardingCompleted: true,
    subscriptionStatus: "team",
  });
  console.log(`[seed-e2e-admin] Created admin user ${E2E_ADMIN_ID}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-e2e-admin] Failed:", err);
    process.exit(1);
  });
