#!/usr/bin/env tsx
/**
 * Direct probe into Reddit scraper — bypasses Inngest to isolate the failure.
 *
 * Calls searchRedditResilient() with real test keywords + subreddits to see
 * what the primary (Apify) and fallback (Public JSON) paths actually return.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { searchRedditResilient, searchRedditPublicSiteWide } from "@/lib/reddit";

async function probe(label: string, fn: () => Promise<any>) {
  console.log(`\n━━━ ${label} ━━━`);
  const t0 = Date.now();
  try {
    const r = await fn();
    const elapsed = Date.now() - t0;
    const posts = Array.isArray(r?.posts) ? r.posts : Array.isArray(r) ? r : [];
    console.log(`   source:   ${r?.source ?? "?"}`);
    console.log(`   error:    ${r?.error ?? "(none)"}`);
    console.log(`   posts:    ${posts.length}`);
    console.log(`   elapsed:  ${elapsed}ms`);
    if (posts.length > 0) {
      console.log(`   sample:   "${(posts[0].title || "").slice(0, 100)}..."`);
    }
  } catch (err) {
    console.log(`   ❌ THREW: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  console.log("🔬 Direct Reddit probe");
  console.log(`   APIFY_API_KEY present:  ${!!process.env.APIFY_API_KEY}`);
  console.log(`   circuit breakers are internal — check result.source for which path fired`);

  // Test 1: r/technology with "Tesla" keyword (should have tons of hits)
  await probe(
    `r/technology — searchRedditResilient`,
    () => searchRedditResilient("technology", ["Tesla", "Tesla Model 3"], 20),
  );

  // Test 2: r/SaaS with "Stripe" keyword
  await probe(
    `r/SaaS — searchRedditResilient`,
    () => searchRedditResilient("SaaS", ["Stripe", "stripe"], 20),
  );

  // Test 3: r/apple with "iPhone 15"
  await probe(
    `r/apple — searchRedditResilient`,
    () => searchRedditResilient("apple", ["iPhone 15", "iPhone 15 Pro"], 20),
  );

  // Test 4: default generic subreddit (what monitor-reddit falls back to)
  await probe(
    `r/AskReddit — searchRedditResilient (fallback subreddit from monitor-reddit)`,
    () => searchRedditResilient("AskReddit", ["Tesla"], 20),
  );

  // Test 5: site-wide search for "Starbucks"
  await probe(
    `Site-wide — searchRedditPublicSiteWide (if available)`,
    () => searchRedditPublicSiteWide(["Starbucks"], 20).catch(() => ({ posts: [], source: "unavailable" as const, error: "function threw" })),
  );

  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("probe failed:", err);
    process.exit(1);
  });
