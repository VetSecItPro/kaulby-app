/**
 * Smoke test: exercise the modified searchRedditResilient() end-to-end.
 * Verifies Apify is now primary and the response shape is correct.
 */

export {};
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { searchRedditResilient } from "@/lib/reddit";

async function main() {
  console.log("Calling searchRedditResilient('SaaS', ['pricing'], 5)...");
  const t0 = Date.now();
  const result = await searchRedditResilient("SaaS", ["pricing"], 5);
  const dt = Date.now() - t0;
  console.log(`\nSource: ${result.source}`);
  console.log(`Runtime: ${dt}ms`);
  console.log(`Posts: ${result.posts.length}`);
  console.log(`Error: ${result.error ?? "(none)"}`);
  if (result.posts.length > 0) {
    const p = result.posts[0];
    console.log("\nFirst post:");
    console.log(`  id: ${p.id}`);
    console.log(`  title: ${p.title?.slice(0, 80)}`);
    console.log(`  selftext length: ${(p.selftext ?? "").length}`);
    console.log(`  subreddit: ${p.subreddit}`);
    console.log(`  author: ${p.author}`);
    console.log(`  created_utc: ${p.created_utc} (${new Date(p.created_utc * 1000).toISOString()})`);
    console.log(`  score: ${p.score}, num_comments: ${p.num_comments}`);
    const allFieldsPresent =
      p.id && p.title && p.subreddit && p.author && p.created_utc && !isNaN(p.created_utc);
    console.log(`\nAll required fields present: ${allFieldsPresent ? "✅" : "❌"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
