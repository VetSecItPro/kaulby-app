#!/usr/bin/env tsx
/**
 * Call the scan-on-demand Reddit logic directly as a function,
 * bypassing Inngest step.run and dispatch. If this inserts rows,
 * then Inngest/step dispatch is the problem. If not, the bug is
 * in scanRedditForMonitor itself.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { monitors, results, audiences } from "@/lib/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { findRelevantSubredditsCached } from "@/lib/ai";
import { searchRedditResilient, searchRedditPublicSiteWide } from "@/lib/reddit";
import { includesTokenized } from "@/lib/content-matcher";

interface MonitorData {
  id: string;
  userId: string;
  companyName: string | null;
  keywords: string[];
  platformUrls: Record<string, string> | null;
  audienceId: string | null;
  monitorType: "keyword" | "ai_discovery";
  discoveryPrompt: string | null;
}

async function contentMatchesMonitor(
  content: { title: string; body?: string; author?: string; platform?: string },
  monitor: MonitorData,
): Promise<{ isMatch: boolean }> {
  const text = `${content.title} ${content.body || ""}`.toLowerCase();
  if (monitor.companyName && includesTokenized(text, monitor.companyName)) {
    return { isMatch: true };
  }
  if (monitor.keywords.length > 0) {
    const matched = monitor.keywords.filter((k) => includesTokenized(text, k));
    if (matched.length > 0) return { isMatch: true };
  }
  return { isMatch: false };
}

async function scanRedditForMonitor(monitor: MonitorData): Promise<number> {
  let count = 0;
  let subreddits: string[] = [];

  if (monitor.audienceId) {
    const audience = await db.query.audiences.findFirst({
      where: eq(audiences.id, monitor.audienceId),
      with: { communities: true },
    });
    if (audience?.communities) {
      subreddits = audience.communities
        .filter((c) => c.platform === "reddit")
        .map((c) => c.identifier);
    }
  }

  if (subreddits.length === 0 && monitor.companyName) {
    try {
      console.log("[Reddit] Using AI to find subreddits for", monitor.companyName);
      subreddits = await findRelevantSubredditsCached(monitor.companyName, monitor.keywords, 10);
      console.log("[Reddit] AI picked:", subreddits);
    } catch (e) {
      console.error("[Reddit] AI subreddit finder failed:", e instanceof Error ? e.message : e);
    }
  }

  if (subreddits.length === 0) {
    subreddits = ["AskReddit", "smallbusiness", "Entrepreneur", "business"];
  }

  console.log("[Reddit] scanning subs:", subreddits);

  for (const subreddit of subreddits) {
    try {
      const searchResult = await searchRedditResilient(subreddit, monitor.keywords, 50);
      console.log(`  r/${subreddit}: src=${searchResult.source} posts=${searchResult.posts.length}`);

      const matchedItems: Array<{ sourceUrl: string; title: string; content: string; author: string; postedAt: Date; metadata: Record<string, unknown> }> = [];

      for (const post of searchResult.posts) {
        const { isMatch } = await contentMatchesMonitor(
          { title: post.title, body: post.selftext, author: post.author, platform: "reddit" },
          monitor,
        );
        if (isMatch) {
          matchedItems.push({
            sourceUrl: post.url || `https://reddit.com${post.permalink}`,
            title: post.title,
            content: post.selftext,
            author: post.author,
            postedAt: new Date(post.created_utc * 1000),
            metadata: { subreddit: post.subreddit, score: post.score, numComments: post.num_comments, source: searchResult.source },
          });
        }
      }
      console.log(`  r/${subreddit}: matched=${matchedItems.length}`);
      if (matchedItems.length === 0) continue;

      const matchedUrls = matchedItems.map((m) => m.sourceUrl);
      const existing = await db.query.results.findMany({
        where: and(eq(results.monitorId, monitor.id), inArray(results.sourceUrl, matchedUrls)),
        columns: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map((r) => r.sourceUrl));
      const newItems = matchedItems.filter((m) => !existingUrls.has(m.sourceUrl));
      console.log(`  r/${subreddit}: new=${newItems.length} (existing=${existingUrls.size})`);

      if (newItems.length > 0) {
        const inserted = await db
          .insert(results)
          .values(
            newItems.map((item) => ({
              monitorId: monitor.id,
              platform: "reddit" as const,
              sourceUrl: item.sourceUrl,
              title: item.title,
              content: item.content,
              author: item.author,
              postedAt: item.postedAt,
              metadata: item.metadata,
            })),
          )
          .returning();
        count += inserted.length;
        console.log(`  r/${subreddit}: INSERTED ${inserted.length}`);
      }
    } catch (e) {
      console.error(`  r/${subreddit}: ERROR`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`TOTAL inserted: ${count}`);
  return count;
}

async function main() {
  const [mon] = await db
    .select()
    .from(monitors)
    .where(eq(monitors.name, "[PLATFORM-TEST] zoom-b2b"))
    .orderBy(desc(monitors.createdAt))
    .limit(1);

  if (!mon) {
    console.log("no zoom-b2b monitor found");
    return;
  }
  console.log("monitor:", mon.id, "keywords:", mon.keywords, "company:", mon.companyName);

  const m: MonitorData = {
    id: mon.id,
    userId: mon.userId,
    companyName: mon.companyName,
    keywords: mon.keywords,
    platformUrls: mon.platformUrls as Record<string, string> | null,
    audienceId: mon.audienceId,
    monitorType: mon.monitorType,
    discoveryPrompt: mon.discoveryPrompt,
  };

  await scanRedditForMonitor(m);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
