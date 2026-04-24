#!/usr/bin/env tsx
/**
 * Debug Reddit scan path — reproduce what scan-on-demand does for Zoom.
 * Temporary script to diagnose 0-result regression.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { searchRedditResilient, searchRedditPublicSiteWide } from "@/lib/reddit";
import { includesTokenized } from "@/lib/content-matcher";

async function main() {
  const companyName = "Zoom";
  const keywords = ["Zoom video", "Zoom meeting"];
  const subs = ["Zoom", "videoconferencing", "remotework"];

  console.log("=== searchRedditResilient per subreddit ===");
  let totalPosts = 0, totalMatched = 0;
  for (const sub of subs) {
    try {
      const r = await searchRedditResilient(sub, keywords, 20);
      const matched = r.posts.filter((p) => {
        const text = `${p.title} ${p.selftext || ""}`.toLowerCase();
        return (
          includesTokenized(text, companyName) ||
          keywords.some((k) => includesTokenized(text, k))
        );
      }).length;
      totalPosts += r.posts.length;
      totalMatched += matched;
      console.log(
        `r/${sub}: src=${r.source} posts=${r.posts.length} matched=${matched}${r.error ? " err=" + r.error : ""}`,
      );
      if (r.posts[0]) {
        console.log(`  sample: "${r.posts[0].title.slice(0, 80)}"`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`r/${sub}: ERR ${msg}`);
    }
  }
  console.log(`TOTAL posts=${totalPosts} matched=${totalMatched}`);

  console.log("\n=== searchRedditPublicSiteWide fallback ===");
  const r = await searchRedditPublicSiteWide([companyName, ...keywords], 50);
  const matched = r.posts.filter((p) => {
    const text = `${p.title} ${p.selftext || ""}`.toLowerCase();
    return (
      includesTokenized(text, companyName) ||
      keywords.some((k) => includesTokenized(text, k))
    );
  }).length;
  console.log(
    `sitewide: posts=${r.posts.length} matched=${matched} err=${r.error || "none"}`,
  );
  if (r.posts[0]) console.log(`  sample: "${r.posts[0].title.slice(0, 80)}"`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
