#!/usr/bin/env tsx
/**
 * Platform Integration Test — end-to-end health check for every platform scanner.
 *
 * Creates 7 REAL monitors covering all 16 supported platforms with natural
 * keyword fits (restaurant chain → Google Reviews + Yelp + Trustpilot,
 * mobile app → App Store + Play Store, dev tool → GitHub + HN + Dev.to,
 * etc.). Fires real scans, polls the DB until results land, then reports
 * per-platform:
 *   - Did the scraper produce results?
 *   - Did AI analysis populate aiSummary?
 *   - What's the persona rate on the resulting summaries?
 *   - Sample summary per platform (qualitative spot-check)
 *
 * Purpose:
 *   - Verify every platform's scraper/actor is alive and returning data
 *   - Verify the summarize prompt generalizes across platform content types
 *   - Identify which platforms are broken / degraded / producing weird output
 *
 * Run (from the repo root):
 *   pnpm tsx scripts/platform-integration-test.ts
 *   pnpm tsx scripts/platform-integration-test.ts --keep         # leave monitors active after
 *   pnpm tsx scripts/platform-integration-test.ts --only=reddit  # filter to one platform
 *
 * Cost per full run:
 *   - OR (Flash analysis): ~7 monitors × ~20 results = 140 calls × $0.001 = ~$0.14
 *   - Apify (Reddit + App/Play Store + etc.): varies, ~$0.10-0.50 total
 *   - Total: ~$0.25-0.70
 *
 * Time: 5-10 min wall clock (scans + AI in parallel).
 *
 * NEVER delete the canary monitor (bff73490-...). This script uses its own
 * [PLATFORM-TEST] prefix and cleans up only rows it created.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { db } from "@/lib/db";
import { users, monitors, results, aiLogs } from "@/lib/db/schema";
import { eq, and, inArray, gte, isNotNull } from "drizzle-orm";
import { Inngest } from "inngest";
import { PERSONA_PROBES, BANNED_OPENERS } from "@/lib/ai/quality-probes";

const args = process.argv.slice(2);
const KEEP = args.includes("--keep");
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const MAX_WAIT_MS = 25 * 60 * 1000; // 25 min — extended for full AI analysis backlog to drain
const POLL_INTERVAL_MS = 15 * 1000;

const MONITOR_PREFIX = "[PLATFORM-TEST]";

type PlatformKey =
  | "reddit"
  | "hackernews"
  | "producthunt"
  | "devto"
  | "googlereviews"
  | "trustpilot"
  | "appstore"
  | "playstore"
  | "youtube"
  | "g2"
  | "yelp"
  | "amazonreviews"
  | "indiehackers"
  | "github"
  | "hashnode"
  | "x";

type TestMonitor = {
  label: string;
  companyName: string;
  keywords: string[];
  platforms: PlatformKey[];
  purpose: string;
  // URL-required platforms need specific identifiers. Monitor-yelp/g2/amazon/
  // playstore scanners read these from monitor.platformUrls. Setting them
  // ensures the scan actually fires instead of the "missing URL" loud-fail
  // path (which we also verified separately).
  platformUrls?: Partial<Record<PlatformKey, string>>;
};

// 3rd-run test matrix: all-new companies. Every monitor includes reddit (user
// ask: confirm reddit works alongside other platforms). URL-required platforms
// get real identifiers via platformUrls so the scanner actually fires.
const TEST_MONITORS: TestMonitor[] = [
  {
    label: "panera-restaurant",
    companyName: "Panera Bread",
    keywords: ["Panera Bread", "Panera"],
    platforms: ["reddit", "googlereviews", "yelp", "trustpilot"],
    purpose: "Restaurant chain — tests reddit + review platforms",
  },
  {
    label: "spotify-mobile",
    companyName: "Spotify",
    keywords: ["Spotify"],
    platforms: ["reddit", "appstore", "playstore"],
    platformUrls: {
      appstore: "324684580",
      playstore: "com.spotify.music",
    },
    purpose: "Consumer mobile app — tests reddit + app stores with IDs",
  },
  {
    label: "anthropic-claude-dev",
    companyName: "Anthropic Claude",
    keywords: ["Anthropic Claude", "Claude API", "claude.ai"],
    platforms: ["reddit", "github", "hackernews", "devto", "hashnode"],
    purpose: "AI dev tool — tests reddit + all technical communities",
  },
  {
    label: "airpods-pro-product",
    companyName: "AirPods Pro",
    keywords: ["AirPods Pro", "AirPods Pro 2"],
    platforms: ["reddit", "youtube", "amazonreviews"],
    platformUrls: {
      amazonreviews: "B0D1XD1ZV3", // AirPods Pro 2 ASIN
    },
    purpose: "Consumer product — tests reddit + youtube + Amazon (with ASIN)",
  },
  {
    label: "zoom-b2b",
    companyName: "Zoom",
    keywords: ["Zoom video", "Zoom meeting"],
    platforms: ["reddit", "g2", "trustpilot"],
    purpose: "B2B SaaS — tests reddit + g2 (companyName fallback) + trustpilot",
  },
  {
    label: "github-copilot-launch",
    companyName: "GitHub Copilot",
    keywords: ["GitHub Copilot", "Copilot"],
    platforms: ["reddit", "producthunt", "indiehackers"],
    purpose: "AI launch — tests reddit + indie communities",
  },
  {
    label: "peloton-fitness",
    companyName: "Peloton",
    keywords: ["Peloton bike", "Peloton"],
    platforms: ["reddit", "appstore", "youtube", "x"],
    platformUrls: {
      appstore: "792750948", // Peloton iOS app ID
    },
    purpose: "Consumer fitness — tests reddit + appstore + x (xAI)",
  },
];

const ALL_PLATFORMS: PlatformKey[] = [
  "reddit", "hackernews", "producthunt", "devto", "googlereviews",
  "trustpilot", "appstore", "playstore", "youtube", "g2", "yelp",
  "amazonreviews", "indiehackers", "github", "hashnode", "x",
];

const inngest = new Inngest({ id: "kaulby-platform-test" });

async function main() {
  console.log("🔬 Platform Integration Test — end-to-end health check\n");

  const activeMonitors = ONLY
    ? TEST_MONITORS.filter((m) => m.platforms.includes(ONLY as PlatformKey))
    : TEST_MONITORS;

  console.log(`   monitors to run:  ${activeMonitors.length}`);
  console.log(`   platforms tested: ${new Set(activeMonitors.flatMap((m) => m.platforms)).size} / ${ALL_PLATFORMS.length}`);
  console.log(`   max wait time:    ${MAX_WAIT_MS / 60_000} min`);
  console.log("");

  // --- Step 1: find admin user ---
  const admin = await db.query.users.findFirst({
    where: eq(users.isAdmin, true),
    columns: { id: true, email: true },
  });
  if (!admin) {
    console.error("❌ No admin user found");
    process.exit(1);
  }
  console.log(`👤 admin: ${admin.email}\n`);

  // --- Step 2: create each monitor ---
  const createdMonitors: Array<{
    monitorId: string;
    label: string;
    platforms: PlatformKey[];
    companyName: string;
    keywords: string[];
    scanFiredAt: Date;
  }> = [];

  for (const m of activeMonitors) {
    const name = `${MONITOR_PREFIX} ${m.label}`;
    // Clean up any prior test monitor with same name first
    await db.update(monitors).set({ isActive: false }).where(
      and(eq(monitors.userId, admin.id), eq(monitors.name, name))
    );
    const [created] = await db
      .insert(monitors)
      .values({
        userId: admin.id,
        name,
        companyName: m.companyName,
        keywords: m.keywords,
        platforms: m.platforms,
        platformUrls: m.platformUrls ?? null,
        isActive: true,
      })
      .returning({ id: monitors.id });
    const scanFiredAt = new Date();
    await inngest.send({
      name: "monitor/scan-now",
      data: { monitorId: created.id, userId: admin.id },
    });
    createdMonitors.push({
      monitorId: created.id,
      label: m.label,
      platforms: m.platforms,
      companyName: m.companyName,
      keywords: m.keywords,
      scanFiredAt,
    });
    console.log(`📡 fired scan: ${m.label.padEnd(24)} [${m.platforms.join(", ")}]`);
  }

  console.log(`\n⏳ Polling for results and AI analysis (max ${MAX_WAIT_MS / 60_000} min)...\n`);

  // --- Step 3: poll until everyone has results AI-analyzed, or timeout ---
  const deadline = Date.now() + MAX_WAIT_MS;
  type Progress = {
    resultsCount: number;
    withAI: number;
    byPlatform: Record<string, { results: number; withAI: number; summaries: string[] }>;
  };
  const latest: Record<string, Progress> = {};

  while (Date.now() < deadline) {
    const allMonitorIds = createdMonitors.map((m) => m.monitorId);
    const rows = await db
      .select({
        id: results.id,
        monitorId: results.monitorId,
        platform: results.platform,
        aiSummary: results.aiSummary,
        aiAnalyzed: results.aiAnalyzed,
      })
      .from(results)
      .where(
        and(
          inArray(results.monitorId, allMonitorIds),
          gte(results.createdAt, createdMonitors[0].scanFiredAt),
        )
      );

    for (const m of createdMonitors) {
      const mRows = rows.filter((r) => r.monitorId === m.monitorId);
      const byPlatform: Progress["byPlatform"] = {};
      for (const r of mRows) {
        byPlatform[r.platform] ||= { results: 0, withAI: 0, summaries: [] };
        byPlatform[r.platform].results++;
        if (r.aiAnalyzed && r.aiSummary) {
          byPlatform[r.platform].withAI++;
          byPlatform[r.platform].summaries.push(r.aiSummary);
        }
      }
      latest[m.monitorId] = {
        resultsCount: mRows.length,
        withAI: mRows.filter((r) => r.aiAnalyzed && r.aiSummary).length,
        byPlatform,
      };
    }

    // Check if all monitors have hit "done enough" state: every expected platform has
    // either produced results OR at least 2 minutes have passed since scan fired.
    const elapsedMs = Date.now() - createdMonitors[0].scanFiredAt.getTime();
    const allDone = createdMonitors.every((m) => {
      const p = latest[m.monitorId];
      if (!p) return false;
      // "Done" when every expected platform has at least 1 AI-analyzed result
      // OR 7 minutes elapsed (some platforms legitimately produce nothing)
      const platformsWithData = Object.values(p.byPlatform).filter((x) => x.withAI > 0).length;
      return platformsWithData >= m.platforms.length || elapsedMs > 7 * 60_000;
    });

    if (allDone) break;

    const completed = createdMonitors.filter((m) => (latest[m.monitorId]?.withAI ?? 0) > 0).length;
    process.stdout.write(
      `\r   [${Math.floor(elapsedMs / 1000)}s elapsed] ${completed}/${createdMonitors.length} monitors have AI results   `,
    );
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.log("\n");

  // --- Step 4: report ---
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PER-MONITOR REPORT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const platformAgg: Record<string, { results: number; withAI: number; personaHits: number; bannedHits: number; summaries: string[] }> = {};
  for (const p of ALL_PLATFORMS) {
    platformAgg[p] = { results: 0, withAI: 0, personaHits: 0, bannedHits: 0, summaries: [] };
  }

  for (const m of createdMonitors) {
    const p = latest[m.monitorId] ?? { resultsCount: 0, withAI: 0, byPlatform: {} };
    console.log(`\n▼ ${m.label} (${m.companyName})`);
    console.log(`  platforms: [${m.platforms.join(", ")}]`);
    console.log(`  total results: ${p.resultsCount}  total ai-analyzed: ${p.withAI}`);
    for (const platform of m.platforms) {
      const pp = p.byPlatform[platform] ?? { results: 0, withAI: 0, summaries: [] };
      for (const s of pp.summaries) {
        if (PERSONA_PROBES.some((r) => r.test(s))) platformAgg[platform].personaHits++;
        if (BANNED_OPENERS.some((r) => r.test(s))) platformAgg[platform].bannedHits++;
      }
      platformAgg[platform].results += pp.results;
      platformAgg[platform].withAI += pp.withAI;
      platformAgg[platform].summaries.push(...pp.summaries);
      const status =
        pp.results === 0 ? "❌ ZERO results — scraper broken?" :
        pp.withAI === 0 ? "⚠️  results but no AI summaries" :
        `✅ ${pp.withAI}/${pp.results} ai-analyzed`;
      console.log(`    ${platform.padEnd(16)} ${status}`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PER-PLATFORM AGGREGATE (across all monitors)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const untested = ALL_PLATFORMS.filter((p) => !activeMonitors.some((m) => m.platforms.includes(p)));
  for (const platform of ALL_PLATFORMS) {
    const agg = platformAgg[platform];
    if (untested.includes(platform)) {
      console.log(`  ${platform.padEnd(16)} ⏭  not tested this run`);
      continue;
    }
    if (agg.results === 0) {
      console.log(`  ${platform.padEnd(16)} ❌ BROKEN — 0 results from scan`);
      continue;
    }
    if (agg.withAI === 0) {
      console.log(`  ${platform.padEnd(16)} ⚠️  DEGRADED — ${agg.results} results, 0 AI-analyzed`);
      continue;
    }
    const personaRate = agg.personaHits / agg.withAI;
    const bannedRate = agg.bannedHits / agg.withAI;
    const flag = personaRate >= 0.9 ? "✅" : personaRate >= 0.75 ? "⚠️" : "❌";
    console.log(
      `  ${platform.padEnd(16)} ${flag} ${String(agg.withAI).padStart(3)}/${String(agg.results).padStart(3)} ai-analyzed  ` +
      `persona=${(personaRate * 100).toFixed(0).padStart(3)}%  banned=${(bannedRate * 100).toFixed(0).padStart(3)}%`,
    );
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SAMPLE SUMMARY PER PLATFORM (qualitative spot-check)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const platform of ALL_PLATFORMS) {
    const agg = platformAgg[platform];
    if (agg.summaries.length === 0) continue;
    console.log(`\n▼ ${platform}`);
    console.log(`  "${agg.summaries[0].slice(0, 400)}${agg.summaries[0].length > 400 ? "..." : ""}"`);
  }

  // --- Step 5: cleanup ---
  console.log("");
  if (KEEP) {
    console.log(`🚧 --keep flag: leaving ${createdMonitors.length} test monitors active`);
    for (const m of createdMonitors) {
      console.log(`   ${m.label}: https://kaulbyapp.com/dashboard/monitors/${m.monitorId}`);
    }
  } else {
    console.log("🧹 Cleanup: deactivating test monitors...");
    for (const m of createdMonitors) {
      await db.update(monitors).set({ isActive: false }).where(eq(monitors.id, m.monitorId));
    }
    console.log(`   ✅ deactivated ${createdMonitors.length} monitors (results preserved)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ platform test failed:", err);
    process.exit(1);
  });
