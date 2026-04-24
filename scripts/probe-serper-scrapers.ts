#!/usr/bin/env tsx
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const { searchYelpSerper, searchG2Serper, searchAmazonSerper } = await import("@/lib/serper");

  console.log("━━━ Yelp (Panera Bread) ━━━");
  try {
    const r = await searchYelpSerper("Panera Bread", 10);
    console.log(`  got ${r.length} reviews`);
    if (r[0]) console.log(`  sample: "${(r[0].text || "").slice(0, 150)}..."`);
  } catch (e) { console.log(`  THREW: ${e instanceof Error ? e.message : e}`); }

  console.log("\n━━━ G2 (Zoom) ━━━");
  try {
    const r = await searchG2Serper("Zoom", 10);
    console.log(`  got ${r.length} reviews`);
    if (r[0]) console.log(`  sample: "${(r[0].text || "").slice(0, 150)}..."`);
  } catch (e) { console.log(`  THREW: ${e instanceof Error ? e.message : e}`); }

  console.log("\n━━━ Amazon (B0D1XD1ZV3 — AirPods Pro 2) ━━━");
  try {
    const r = await searchAmazonSerper("B0D1XD1ZV3", 10);
    console.log(`  got ${r.length} reviews`);
    if (r[0]) console.log(`  sample: "${(r[0].text || "").slice(0, 150)}..."`);
  } catch (e) { console.log(`  THREW: ${e instanceof Error ? e.message : e}`); }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
