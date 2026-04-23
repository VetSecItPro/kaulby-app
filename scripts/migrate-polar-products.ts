#!/usr/bin/env tsx
/**
 * Polar product migration — creates the new Solo/Scale/Growth product catalog.
 *
 * Run with:
 *   POLAR_WRITE_TOKEN=polar_oat_xxxxxxxxx pnpm tsx scripts/migrate-polar-products.ts
 *
 * What it does (idempotent — safe to re-run):
 * 1. Creates 6 subscription products: Solo/Scale/Growth × monthly/annual
 * 2. Creates new Day Pass at $15 (one-time)
 * 3. Renames existing "Kaulby Team Extra Seat" products to "Kaulby Growth Extra Seat"
 *    (same product IDs, same price, just name update)
 * 4. Archives legacy products: Kaulby Pro Monthly/Annual, Kaulby Team Monthly/Annual,
 *    and the old $10 Day Pass
 * 5. Writes the new env var names + values to .env.local and prints the block
 *    to paste into Vercel + GitHub Actions secrets
 *
 * Token must have scopes: products:read, products:write, prices:write
 */

import { Polar } from "@polar-sh/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ORG_ID = "ba1e9b11-de34-41d7-838f-8a6aad491da4";
const ENV_FILE = join(process.cwd(), ".env.local");

// Products to create. `intervalType` tells us whether to call createRecurring
// (with recurringInterval) or createOneTime (flat).
const PRODUCTS_TO_CREATE: Array<{
  envKey: string;
  name: string;
  interval: "month" | "year" | null; // null = one-time
  priceCents: number;
}> = [
  { envKey: "POLAR_SOLO_MONTHLY_PRODUCT_ID",   name: "Kaulby Solo Monthly",   interval: "month", priceCents: 3900 },
  { envKey: "POLAR_SOLO_ANNUAL_PRODUCT_ID",    name: "Kaulby Solo Annual",    interval: "year",  priceCents: 37400 },
  { envKey: "POLAR_SCALE_MONTHLY_PRODUCT_ID",  name: "Kaulby Scale Monthly",  interval: "month", priceCents: 7900 },
  { envKey: "POLAR_SCALE_ANNUAL_PRODUCT_ID",   name: "Kaulby Scale Annual",   interval: "year",  priceCents: 75800 },
  { envKey: "POLAR_GROWTH_MONTHLY_PRODUCT_ID", name: "Kaulby Growth Monthly", interval: "month", priceCents: 14900 },
  { envKey: "POLAR_GROWTH_ANNUAL_PRODUCT_ID",  name: "Kaulby Growth Annual",  interval: "year",  priceCents: 143000 },
  { envKey: "POLAR_DAY_PASS_PRODUCT_ID",       name: "Kaulby Day Pass (Scale, 24hr)", interval: null, priceCents: 1500 },
];

// Products to archive by matching their exact current name.
const PRODUCTS_TO_ARCHIVE_BY_NAME = [
  "Kaulby Pro Monthly",
  "Kaulby Pro Annual",
  "Kaulby Team Monthly",
  "Kaulby Team Annual",
  "Kaulby Day Pass", // old $10 one
];

// Products to rename by matching their exact current name.
const PRODUCTS_TO_RENAME: Array<{ from: string; to: string }> = [
  { from: "Kaulby Team Extra Seat Monthly", to: "Kaulby Growth Extra Seat Monthly" },
  { from: "Kaulby Team Extra Seat Yearly",  to: "Kaulby Growth Extra Seat Yearly" },
];

async function main() {
  const token = process.env.POLAR_WRITE_TOKEN || process.env.POLAR_ACCESS_TOKEN;
  if (!token) {
    console.error("❌ Set POLAR_WRITE_TOKEN (or POLAR_ACCESS_TOKEN) in env");
    process.exit(1);
  }

  const polar = new Polar({ accessToken: token });

  // --- Step 1: list existing products ---
  console.log("📋 Listing existing Kaulby products...");
  const existing = [];
  for await (const page of await polar.products.list({ limit: 100 })) {
    for (const p of page.result.items) {
      if (p.name.startsWith("Kaulby")) existing.push(p);
    }
  }
  console.log(`   Found ${existing.length} existing Kaulby products\n`);

  const byName = new Map(existing.map((p) => [p.name, p]));
  const results: Record<string, string> = {};

  // --- Step 2: create new products (skip if already exists by name) ---
  console.log("🆕 Creating new products...");
  for (const spec of PRODUCTS_TO_CREATE) {
    const existingMatch = byName.get(spec.name);
    if (existingMatch) {
      console.log(`   ⏭  ${spec.name} already exists (${existingMatch.id})`);
      results[spec.envKey] = existingMatch.id;
      continue;
    }

    try {
      const product =
        spec.interval === null
          ? await polar.products.create({
              name: spec.name,
              recurringInterval: null,
              prices: [{ amountType: "fixed", priceAmount: spec.priceCents, priceCurrency: "usd" }],
            })
          : await polar.products.create({
              name: spec.name,
              recurringInterval: spec.interval,
              prices: [{ amountType: "fixed", priceAmount: spec.priceCents, priceCurrency: "usd" }],
            });
      console.log(`   ✅ Created: ${spec.name} → ${product.id}`);
      results[spec.envKey] = product.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ Failed: ${spec.name} — ${message}`);
    }
  }

  // --- Step 3: rename existing seat products ---
  console.log("\n✏️  Renaming seat products...");
  for (const { from, to } of PRODUCTS_TO_RENAME) {
    const p = byName.get(from);
    if (!p) {
      console.log(`   ⏭  ${from} not found, skipping`);
      continue;
    }
    try {
      await polar.products.update({
        id: p.id,
        productUpdate: { name: to },
      });
      console.log(`   ✅ Renamed: ${from} → ${to}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ Failed rename: ${from} — ${message}`);
    }
  }

  // Capture seat product IDs for env output (they keep same ID after rename).
  const seatMonthly = byName.get("Kaulby Team Extra Seat Monthly") || byName.get("Kaulby Growth Extra Seat Monthly");
  const seatAnnual  = byName.get("Kaulby Team Extra Seat Yearly") || byName.get("Kaulby Growth Extra Seat Yearly");
  if (seatMonthly) results["POLAR_GROWTH_SEAT_MONTHLY_PRODUCT_ID"] = seatMonthly.id;
  if (seatAnnual)  results["POLAR_GROWTH_SEAT_ANNUAL_PRODUCT_ID"]  = seatAnnual.id;

  // --- Step 4: archive legacy products ---
  console.log("\n🗄  Archiving legacy products...");
  for (const name of PRODUCTS_TO_ARCHIVE_BY_NAME) {
    const p = byName.get(name);
    if (!p) {
      console.log(`   ⏭  ${name} not found, skipping`);
      continue;
    }
    if (p.isArchived) {
      console.log(`   ⏭  ${name} already archived`);
      continue;
    }
    try {
      await polar.products.update({
        id: p.id,
        productUpdate: { isArchived: true },
      });
      console.log(`   ✅ Archived: ${name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ Failed archive: ${name} — ${message}`);
    }
  }

  // --- Step 5: write results to .env.local + print ---
  console.log("\n📝 Updating .env.local...");
  if (existsSync(ENV_FILE)) {
    let env = readFileSync(ENV_FILE, "utf8");
    for (const [key, value] of Object.entries(results)) {
      const line = `${key}=${value}`;
      if (env.includes(`${key}=`)) {
        // Replace existing line
        env = env.replace(new RegExp(`^${key}=.*$`, "m"), line);
      } else {
        // Append new line
        env += (env.endsWith("\n") ? "" : "\n") + line + "\n";
      }
    }
    writeFileSync(ENV_FILE, env, "utf8");
    console.log("   ✅ .env.local updated");
  } else {
    console.log("   ⚠️  .env.local not found — skipping write");
  }

  console.log("\n=========================================================");
  console.log("✅ Polar product migration complete.");
  console.log("=========================================================\n");
  console.log("Env vars to paste into Vercel + GitHub Actions secrets:\n");
  for (const [key, value] of Object.entries(results)) {
    console.log(`${key}=${value}`);
  }
  console.log("\nTo sync Vercel env from .env.local, run:");
  console.log("   for k in " + Object.keys(results).join(" ") + "; do");
  console.log("     value=$(grep ^$k .env.local | cut -d= -f2)");
  console.log("     vercel env rm $k production --yes 2>/dev/null || true");
  console.log("     echo $value | vercel env add $k production");
  console.log("   done\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
