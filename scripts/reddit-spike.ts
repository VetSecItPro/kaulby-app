/**
 * Reddit scraper spike — measures real Apify cost + watermark support.
 *
 * Steps:
 *   1. Fetch actor metadata (schema) for automation-lab/reddit-scraper
 *   2. Baseline run on r/SaaS with maxItems=10, skipComments=true
 *   3. Immediate re-run (dedup/watermark behavior observation)
 *   4. trudax/reddit-scraper-lite fallback comparison
 * Writes findings to .mdmp/reddit-spike-results-2026-04-21.md.
 *
 * Usage: npx tsx scripts/reddit-spike.ts
 */

export {};
import fs from "node:fs";
import path from "node:path";

const APIFY_API_BASE = "https://api.apify.com/v2";
const TOKEN = process.env.APIFY_API_KEY;
if (!TOKEN) {
  console.error("APIFY_API_KEY missing — source .env.local first");
  process.exit(1);
}

type ActorMeta = {
  data: {
    id: string;
    name: string;
    title: string;
    defaultRunOptions?: Record<string, unknown>;
    exampleRunInput?: { body?: string; contentType?: string };
    isPaid?: boolean;
    pricingInfos?: unknown[];
  };
};

type RunResponse = {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
    usageTotalUsd?: number;
    stats?: {
      inputBodyLen?: number;
      runTimeSecs?: number;
      durationMillis?: number;
      computeUnits?: number;
    };
    meta?: { origin?: string };
    startedAt?: string;
    finishedAt?: string;
  };
};

type DatasetResponse<T> = T[];

async function fetchActor(actorId: string): Promise<ActorMeta> {
  const apiActorId = actorId.replace("/", "~");
  const r = await fetch(`${APIFY_API_BASE}/acts/${apiActorId}?token=${TOKEN}`);
  if (!r.ok) throw new Error(`Actor fetch ${actorId} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function runActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  label: string,
  maxWaitMs = 180_000
): Promise<{ items: T[]; run: RunResponse["data"] }> {
  const apiActorId = actorId.replace("/", "~");
  const t0 = Date.now();
  console.log(`[${label}] start actor=${actorId} input=${JSON.stringify(input).slice(0, 200)}`);
  const startR = await fetch(`${APIFY_API_BASE}/acts/${apiActorId}/runs?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!startR.ok) throw new Error(`Start failed ${startR.status}: ${await startR.text()}`);
  const start = (await startR.json()) as RunResponse;
  const runId = start.data.id;
  const datasetId = start.data.defaultDatasetId;
  console.log(`[${label}] runId=${runId}`);

  while (Date.now() - t0 < maxWaitMs) {
    const poll = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}?token=${TOKEN}`);
    if (!poll.ok) throw new Error(`Poll ${poll.status}`);
    const run = (await poll.json()) as RunResponse;
    const status = run.data.status;
    if (status === "SUCCEEDED") {
      const ds = await fetch(`${APIFY_API_BASE}/datasets/${datasetId}/items?token=${TOKEN}&clean=true`);
      const items = (await ds.json()) as DatasetResponse<T>;
      console.log(
        `[${label}] SUCCEEDED items=${items.length} usd=$${run.data.usageTotalUsd ?? "?"} runtime=${run.data.stats?.runTimeSecs ?? run.data.stats?.durationMillis}ms`
      );
      return { items, run: run.data };
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Run ${status}: ${JSON.stringify(run.data).slice(0, 500)}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Run timed out after ${maxWaitMs}ms`);
}

interface RedditPost {
  id?: string;
  dataType?: string;
  title?: string;
  url?: string;
  createdAt?: string;
  parsedCommunityName?: string;
  [k: string]: unknown;
}

function sig(p: RedditPost): string {
  return String(p.id ?? p.url ?? p.title ?? JSON.stringify(p).slice(0, 80));
}

async function main() {
  const report: string[] = [];
  const log = (s: string) => {
    console.log(s);
    report.push(s);
  };

  log("# Reddit Scraper Spike — 2026-04-21\n");

  // ─── STEP 1: schema discovery ────────────────────────────────────
  log("## Step 1 — Actor metadata (automation-lab/reddit-scraper)\n");
  let autoMeta: ActorMeta | null = null;
  try {
    autoMeta = await fetchActor("automation-lab/reddit-scraper");
    log(`- **ID:** ${autoMeta.data.id}`);
    log(`- **Name:** ${autoMeta.data.name}`);
    log(`- **Title:** ${autoMeta.data.title}`);
    log(`- **isPaid:** ${autoMeta.data.isPaid}`);
    const input = autoMeta.data.exampleRunInput?.body;
    if (input) {
      log(`\n### Example input body\n\`\`\`json\n${input.slice(0, 2000)}\n\`\`\``);
    }
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── STEP 2: baseline run on r/SaaS ──────────────────────────────
  // NOTE: automation-lab schema uses { urls, maxPostsPerSource, sort } not startUrls
  log("\n## Step 2 — Baseline run (r/SaaS, maxPostsPerSource=25, sort=new)\n");
  let run2Items: RedditPost[] = [];
  let run2: RunResponse["data"] | null = null;
  try {
    const res = await runActor<RedditPost>(
      "automation-lab/reddit-scraper",
      {
        urls: ["https://www.reddit.com/r/SaaS/"],
        maxPostsPerSource: 25,
        sort: "new",
      },
      "step2"
    );
    run2Items = res.items;
    run2 = res.run;
    log(`- **Items returned:** ${res.items.length}`);
    log(`- **Cost (usageTotalUsd):** $${res.run.usageTotalUsd ?? "unknown"}`);
    log(`- **Runtime:** ${res.run.stats?.runTimeSecs ?? "?"}s`);
    log(`- **Compute units:** ${res.run.stats?.computeUnits ?? "?"}`);
    if (res.items.length > 0) {
      const p = res.items[0];
      log(`- **First item dataType:** ${p.dataType ?? "?"}`);
      log(`- **First item id:** ${p.id ?? "?"}`);
      log(`- **First item title:** ${(p.title ?? "").slice(0, 80)}`);
    }
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── STEP 3: immediate re-run — dedup/watermark check ───────────
  log("\n## Step 3 — Immediate re-run (same input, observe duplicates)\n");
  try {
    const res = await runActor<RedditPost>(
      "automation-lab/reddit-scraper",
      {
        urls: ["https://www.reddit.com/r/SaaS/"],
        maxPostsPerSource: 25,
        sort: "new",
      },
      "step3"
    );
    const run2Set = new Set(run2Items.map(sig));
    const overlap = res.items.filter((p) => run2Set.has(sig(p))).length;
    const novel = res.items.length - overlap;
    log(`- **Items returned:** ${res.items.length}`);
    log(`- **Cost:** $${res.run.usageTotalUsd ?? "?"}`);
    log(`- **Overlap with step 2 (dupes):** ${overlap}/${res.items.length}`);
    log(`- **Novel items:** ${novel}`);
    log(
      `- **Watermark verdict:** ${overlap === res.items.length ? "❌ NO watermark — re-run returns identical items" : novel === res.items.length ? "✅ FULL watermark — no duplicates" : "⚠️ PARTIAL — some overlap"}`
    );
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── STEP 4: trudax-lite comparison (larger sample for rate accuracy) ─
  log("\n## Step 4 — trudax/reddit-scraper-lite (25 items for rate accuracy)\n");
  try {
    const res = await runActor<RedditPost>(
      "trudax/reddit-scraper-lite",
      {
        startUrls: [{ url: "https://www.reddit.com/r/SaaS/new/" }],
        maxItems: 25,
        skipComments: true,
      },
      "step4"
    );
    log(`- **Items returned:** ${res.items.length}`);
    log(`- **Cost:** $${res.run.usageTotalUsd ?? "?"}`);
    log(`- **Runtime:** ${res.run.stats?.runTimeSecs ?? "?"}s`);
    if (res.items.length > 0) {
      const p = res.items[0];
      log(`- **First item id:** ${p.id ?? "?"}`);
      log(`- **First item title:** ${(p.title ?? "").slice(0, 80)}`);
    }
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── STEP 5: automation-lab on HOT subreddit (r/technology, 50 items) ──
  log("\n## Step 5 — automation-lab on r/technology, maxPostsPerSource=50 (cost scaling test)\n");
  try {
    const res = await runActor<RedditPost>(
      "automation-lab/reddit-scraper",
      { urls: ["https://www.reddit.com/r/technology/"], maxPostsPerSource: 50, sort: "new" },
      "step5"
    );
    log(`- **Items returned:** ${res.items.length}`);
    log(`- **Cost:** $${res.run.usageTotalUsd ?? "?"}`);
    log(`- **$/1K items implied:** $${res.items.length > 0 ? ((Number(res.run.usageTotalUsd ?? 0) / res.items.length) * 1000).toFixed(4) : "?"}`);
    log(`- **Runtime:** ${res.run.stats?.runTimeSecs ?? "?"}s`);
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── STEP 6: practicaltools/apify-reddit-api (alternative actor) ──────
  log("\n## Step 6 — practicaltools/apify-reddit-api\n");
  try {
    const meta = await fetchActor("practicaltools/apify-reddit-api");
    log(`- **Schema example:** ${meta.data.exampleRunInput?.body?.slice(0, 300) ?? "(none)"}`);
    const body = meta.data.exampleRunInput?.body;
    if (body) {
      const example = JSON.parse(body) as Record<string, unknown>;
      // Mutate example to target r/SaaS with small sample
      if ("startUrls" in example) example.startUrls = [{ url: "https://www.reddit.com/r/SaaS/new/" }];
      if ("urls" in example) example.urls = ["https://www.reddit.com/r/SaaS/"];
      if ("subreddits" in example) example.subreddits = ["SaaS"];
      if ("maxItems" in example) example.maxItems = 25;
      if ("maxPosts" in example) example.maxPosts = 25;
      if ("maxPostsPerSource" in example) example.maxPostsPerSource = 25;
      if ("limit" in example) example.limit = 25;
      const res = await runActor<RedditPost>("practicaltools/apify-reddit-api", example, "step6", 120_000);
      log(`- **Items returned:** ${res.items.length}`);
      log(`- **Cost:** $${res.run.usageTotalUsd ?? "?"}`);
      log(`- **$/1K items implied:** $${res.items.length > 0 ? ((Number(res.run.usageTotalUsd ?? 0) / res.items.length) * 1000).toFixed(4) : "?"}`);
    }
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── STEP 7: fatihtahta/reddit-scraper-search-fast ───────────────────
  log("\n## Step 7 — fatihtahta/reddit-scraper-search-fast\n");
  try {
    const meta = await fetchActor("fatihtahta/reddit-scraper-search-fast");
    log(`- **Schema example:** ${meta.data.exampleRunInput?.body?.slice(0, 300) ?? "(none)"}`);
    const body = meta.data.exampleRunInput?.body;
    if (body) {
      const example = JSON.parse(body) as Record<string, unknown>;
      if ("startUrls" in example) example.startUrls = [{ url: "https://www.reddit.com/r/SaaS/new/" }];
      if ("urls" in example) example.urls = ["https://www.reddit.com/r/SaaS/"];
      if ("subreddits" in example) example.subreddits = ["SaaS"];
      if ("maxItems" in example) example.maxItems = 25;
      if ("maxPosts" in example) example.maxPosts = 25;
      if ("maxPostsPerSource" in example) example.maxPostsPerSource = 25;
      if ("limit" in example) example.limit = 25;
      const res = await runActor<RedditPost>("fatihtahta/reddit-scraper-search-fast", example, "step7", 120_000);
      log(`- **Items returned:** ${res.items.length}`);
      log(`- **Cost:** $${res.run.usageTotalUsd ?? "?"}`);
      log(`- **$/1K items implied:** $${res.items.length > 0 ? ((Number(res.run.usageTotalUsd ?? 0) / res.items.length) * 1000).toFixed(4) : "?"}`);
    }
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── STEP 8: epctex/reddit-scraper (another alternative) ─────────────
  log("\n## Step 8 — epctex/reddit-scraper\n");
  try {
    const meta = await fetchActor("epctex/reddit-scraper");
    log(`- **Schema example:** ${meta.data.exampleRunInput?.body?.slice(0, 300) ?? "(none)"}`);
    const body = meta.data.exampleRunInput?.body;
    if (body) {
      const example = JSON.parse(body) as Record<string, unknown>;
      if ("startUrls" in example) example.startUrls = [{ url: "https://www.reddit.com/r/SaaS/new/" }];
      if ("urls" in example) example.urls = ["https://www.reddit.com/r/SaaS/"];
      if ("search" in example) example.search = "SaaS";
      if ("maxItems" in example) example.maxItems = 25;
      const res = await runActor<RedditPost>("epctex/reddit-scraper", example, "step8", 120_000);
      log(`- **Items returned:** ${res.items.length}`);
      log(`- **Cost:** $${res.run.usageTotalUsd ?? "?"}`);
      log(`- **$/1K items implied:** $${res.items.length > 0 ? ((Number(res.run.usageTotalUsd ?? 0) / res.items.length) * 1000).toFixed(4) : "?"}`);
    }
  } catch (e) {
    log(`**FAILED:** ${e instanceof Error ? e.message : String(e)}`);
  }

  // ─── Summary ────────────────────────────────────────────────────
  log("\n## Summary\n");
  log(`- Posts measured: see steps 2-4 above`);
  log(`- Real per-scan cost = usageTotalUsd from each step`);
  log(`- Watermark support = verdict in step 3`);
  log(`- Projected monthly cost = per-scan × 1800 runs × per-Pro-user × N users`);

  // Write report
  const outDir = path.join(process.cwd(), ".mdmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "reddit-spike-results-2026-04-21.md");
  fs.writeFileSync(outPath, report.join("\n") + "\n");
  console.log(`\nReport written: ${outPath}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
