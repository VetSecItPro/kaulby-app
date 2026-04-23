#!/usr/bin/env tsx
/**
 * W3.8 — PostHog dashboards bootstrap.
 *
 * Creates 3 operational dashboards via the PostHog REST API:
 *   1. Activation funnel  — signup → first monitor → first scan → conversion
 *   2. AI health          — analysis count, failure rate, cost vs budget
 *   3. Scan reliability   — scans by platform, failures, degraded paths
 *
 * Required env (one of):
 *   POSTHOG_PERSONAL_API_KEY=phx_...   (preferred name)
 *   POSTHOG_API_KEY=phx_...            (alt)
 *
 * Run:
 *   pnpm tsx scripts/setup-posthog-dashboards.ts
 *
 * Idempotent — re-running matches dashboards by name and reuses if found.
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com").replace(/\/$/, "");
const TOKEN = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_API_KEY;

if (!TOKEN) {
  console.error("❌ Set POSTHOG_PERSONAL_API_KEY (phx_...) in .env.local");
  console.error("   Generate at: https://us.posthog.com → avatar → Personal API keys");
  console.error("   Required scopes: dashboard:write, insight:write, dashboard:read, insight:read, query:read");
  process.exit(1);
}
if (!TOKEN.startsWith("phx_")) {
  console.error(`❌ POSTHOG_PERSONAL_API_KEY doesn't look like a personal key (got prefix ${TOKEN.slice(0, 4)}...)`);
  console.error("   Personal keys start with phx_, project keys (phc_) won't work for dashboard creation");
  process.exit(1);
}

async function ph(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${HOST}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PH ${init.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function getProjectId(): Promise<number> {
  // Use @current literal in URLs — PostHog resolves it server-side from the
  // token. Avoids needing project:read scope to resolve the numeric id.
  // The actual id is captured from the first dashboard list response for logging.
  const r = await ph("/api/projects/@current/dashboards/?limit=1");
  return r?.results?.[0]?.team_id ?? 0;
}

async function findDashboardByName(projectId: number, name: string): Promise<{ id: number } | null> {
  const data = await ph(`/api/projects/@current/dashboards/?search=${encodeURIComponent(name)}&limit=20`);
  return data?.results?.find((d: any) => d.name === name) || null;
}

async function createDashboard(projectId: number, name: string, description: string): Promise<{ id: number }> {
  const existing = await findDashboardByName(projectId, name);
  if (existing) {
    console.log(`   ⏭  Dashboard "${name}" already exists (id=${existing.id})`);
    return existing;
  }
  const created = await ph(`/api/projects/@current/dashboards/`, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
  console.log(`   ✅ Created dashboard "${name}" (id=${created.id})`);
  return created;
}

// Cache the project-wide insight list once per run so we can dedupe without
// hitting the buggy ?dashboards=N filter (which 500s on PostHog server side).
let _insightCache: Array<{ id: number; name: string; dashboards: number[] }> | null = null;
async function loadInsightCache(): Promise<typeof _insightCache> {
  if (_insightCache) return _insightCache;
  const collected: any[] = [];
  let next: string | null = "/api/projects/@current/insights/?limit=200";
  while (next) {
    const page: any = await ph(next.replace(/^https?:\/\/[^/]+/, ""));
    collected.push(...(page.results ?? []));
    next = page.next || null;
    if (collected.length > 5000) break; // safety
  }
  _insightCache = collected.map((i: any) => ({
    id: i.id,
    name: i.name,
    dashboards: (i.dashboards || []) as number[],
  }));
  return _insightCache;
}

async function createInsight(projectId: number, dashboardId: number, name: string, query: any): Promise<void> {
  const cache = await loadInsightCache();
  const existing = cache?.find((i) => i.name === name && i.dashboards.includes(dashboardId));
  if (existing) {
    console.log(`     ⏭  Insight "${name}" already on dashboard (id=${existing.id})`);
    return;
  }
  await ph(`/api/projects/@current/insights/`, {
    method: "POST",
    body: JSON.stringify({
      name,
      dashboards: [dashboardId],
      query,
    }),
  });
  console.log(`     ✅ Insight "${name}"`);
}

// --------------------------------------------------------------------------
// Insight definitions — all use the modern PostHog HogQL/Trends query schema
// --------------------------------------------------------------------------

const TRENDS_LAST_30D = (eventName: string, breakdown?: string) => ({
  kind: "InsightVizNode",
  source: {
    kind: "TrendsQuery",
    series: [{ kind: "EventsNode", event: eventName, name: eventName, math: "total" }],
    interval: "day",
    dateRange: { date_from: "-30d" },
    ...(breakdown ? { breakdownFilter: { breakdown_type: "event", breakdown } } : {}),
  },
});

const FUNNEL = (steps: { event: string; name?: string }[]) => ({
  kind: "InsightVizNode",
  source: {
    kind: "FunnelsQuery",
    series: steps.map((s) => ({ kind: "EventsNode", event: s.event, name: s.name || s.event })),
    dateRange: { date_from: "-30d" },
    funnelsFilter: { funnelVizType: "steps", funnelOrderType: "ordered" },
  },
});

// --------------------------------------------------------------------------

async function main() {
  console.log(`🔌 PostHog: ${HOST}\n`);
  const projectId = await getProjectId();
  console.log(`📂 Project id: ${projectId}\n`);

  // ===== Dashboard 1: Activation funnel =====
  console.log("📊 Dashboard 1: Activation funnel");
  const d1 = await createDashboard(
    projectId,
    "Kaulby — Activation funnel",
    "Where signups drop off on the way to paying. Funnel: signup → first monitor → first scan → first result viewed → conversion."
  );
  await createInsight(projectId, d1.id, "Activation funnel (last 30d)", FUNNEL([
    { event: "user_signed_up", name: "Signed up" },
    { event: "monitor_created", name: "Created monitor" },
    { event: "scan.completed", name: "First scan completed" },
    { event: "result_viewed", name: "Viewed result" },
    { event: "subscription_created", name: "Converted to paid" },
  ]));
  await createInsight(projectId, d1.id, "Daily signups", TRENDS_LAST_30D("user_signed_up"));
  await createInsight(projectId, d1.id, "Daily monitors created", TRENDS_LAST_30D("monitor_created"));
  await createInsight(projectId, d1.id, "Daily conversions", TRENDS_LAST_30D("subscription_created"));
  await createInsight(projectId, d1.id, "Daily Day Pass purchases", TRENDS_LAST_30D("day_pass_purchased"));

  // ===== Dashboard 2: AI health =====
  console.log("\n📊 Dashboard 2: AI health");
  const d2 = await createDashboard(
    projectId,
    "Kaulby — AI health",
    "AI analysis volume, failure rate, and cost trending. Watch for cap approaches and quality regressions."
  );
  await createInsight(projectId, d2.id, "AI analysis volume by tier", TRENDS_LAST_30D("ai_analysis_completed", "plan"));
  await createInsight(projectId, d2.id, "AI failures by tier", TRENDS_LAST_30D("ai_analysis_failed", "plan"));
  await createInsight(projectId, d2.id, "Tier downgrade events (Sonnet → Flash)", TRENDS_LAST_30D("ai_analysis.tier_downgrade"));
  await createInsight(projectId, d2.id, "AI cost cap hits", TRENDS_LAST_30D("ai_cost_cap_reached"));
  await createInsight(projectId, d2.id, "Eval baseline regressions", TRENDS_LAST_30D("ai_eval_regression"));

  // ===== Dashboard 3: Scan reliability =====
  console.log("\n📊 Dashboard 3: Scan reliability");
  const d3 = await createDashboard(
    projectId,
    "Kaulby — Scan reliability",
    "Per-platform scan success/failure rates and known degradation flags. First place to look when 'monitors aren't returning results' tickets come in."
  );
  await createInsight(projectId, d3.id, "Scans completed by platform", TRENDS_LAST_30D("scan.completed", "platform"));
  await createInsight(projectId, d3.id, "Scan failures by platform", TRENDS_LAST_30D("scan.failed", "platform"));
  await createInsight(projectId, d3.id, "Reddit Apify circuit-breaker trips", TRENDS_LAST_30D("reddit.apify_degraded"));
  await createInsight(projectId, d3.id, "Indie Hackers fetch outcomes", TRENDS_LAST_30D("ih_fetch", "outcome"));
  await createInsight(projectId, d3.id, "GitHub webhook deliveries received", TRENDS_LAST_30D("github_webhook.received"));
  // PR-E.1 shared-scan dedup observability — hit/miss per platform quantifies
  // the cost-savings from keyword-agnostic caching (Reddit Apify, GitHub per-keyword).
  // Hit-ratio = hits / (hits + misses). At 100 Team users, expect 0.6-0.8.
  await createInsight(projectId, d3.id, "Shared-scan cache hits by platform", TRENDS_LAST_30D("shared_scan_hit", "platform"));
  await createInsight(projectId, d3.id, "Shared-scan cache misses by platform", TRENDS_LAST_30D("shared_scan_miss", "platform"));
  // AI quality canary — hard-floor pass/fail trend. This is the outage-detection
  // dashboard first check after any "AI summaries look broken" report.
  await createInsight(projectId, d3.id, "AI quality canary passes", TRENDS_LAST_30D("ai_quality_check"));

  console.log("\n=========================================================");
  console.log("✅ PostHog dashboards setup complete");
  console.log("=========================================================");
  console.log(`\nView them:`);
  console.log(`  • ${HOST}/project/${projectId}/dashboard/${d1.id}  Activation funnel`);
  console.log(`  • ${HOST}/project/${projectId}/dashboard/${d2.id}  AI health`);
  console.log(`  • ${HOST}/project/${projectId}/dashboard/${d3.id}  Scan reliability`);
  console.log(`\nIf any insight shows "no data", the underlying event isn't firing yet.`);
  console.log(`Spot-check by triggering the action in app, then refresh the chart.`);
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
