/**
 * Hourly cron: snapshot key external-vendor metrics into our DB.
 *
 * Why: admin dashboard at /manage/observability/vendors reads from
 * vendor_metrics instead of hitting Apify/OpenRouter/xAI APIs on every
 * page load. Decouples admin UX from vendor API availability + rate limits.
 *
 * Coverage:
 * - Apify (account quota — main cost concern)
 * - OpenRouter (account credits — primary AI billing)
 * - xAI Grok (account credits — X-platform scraping)
 * - Sentry (open issues count, error rate)
 * - Polar (active subscriptions, customer count)
 * - Inngest (recent function run health)
 * - Resend (24h email volume + bounce rate)
 * - PostHog (key-event volume — needs personal API key)
 * - Langfuse (trace volume + p95 latency, last 1h)
 * - Vercel (last deployment status — needs VERCEL_TOKEN)
 *
 * Per-vendor try/catch isolation: one vendor outage doesn't break the
 * snapshot for others. Failures are logged + a `_snapshot_failed: true`
 * metadata row is recorded so the admin tile can show vendor-down state.
 */

import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { pooledDb } from "@/lib/db";
import { vendorMetrics } from "@/lib/db/schema";

interface VendorMetricRow {
  vendor: string;
  metric: string;
  value: number | null;
  metadata: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR FETCHERS — each returns rows to insert OR a failure marker row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apify usage snapshot.
 * Endpoint: GET /v2/users/me — returns the current month's usage data.
 */
async function fetchApifyMetrics(): Promise<VendorMetricRow[]> {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    return [{
      vendor: "apify",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "APIFY_API_KEY not set" },
    }];
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${apiKey}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Apify /users/me HTTP ${res.status}`);
    }
    const body = await res.json();
    const data = body?.data ?? {};
    const plan = data?.plan ?? {};
    const usage = data?.currentUsage ?? {};
    const limit = Number(plan?.maxMonthlyUsageUsd ?? 0);
    const used = Number(usage?.usageTotalUsd ?? 0);
    const remaining = Math.max(0, limit - used);

    return [
      {
        vendor: "apify",
        metric: "monthly_usage_used_usd",
        value: used,
        metadata: { tier: plan?.tier ?? "FREE", planId: plan?.id ?? "FREE" },
      },
      {
        vendor: "apify",
        metric: "monthly_usage_limit_usd",
        value: limit,
        metadata: null,
      },
      {
        vendor: "apify",
        metric: "monthly_usage_remaining_usd",
        value: remaining,
        metadata: null,
      },
      {
        vendor: "apify",
        metric: "monthly_usage_pct",
        value: limit > 0 ? (used / limit) * 100 : null,
        metadata: null,
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] apify failed", { error: msg });
    return [{
      vendor: "apify",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * OpenRouter usage snapshot.
 * Endpoint: GET /api/v1/key — returns the current API key's usage stats.
 */
async function fetchOpenRouterMetrics(): Promise<VendorMetricRow[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return [{
      vendor: "openrouter",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "OPENROUTER_API_KEY not set" },
    }];
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter /key HTTP ${res.status}`);
    }
    const body = await res.json();
    const data = body?.data ?? {};
    const used = Number(data?.usage ?? 0);
    const limit = data?.limit != null ? Number(data.limit) : null;
    const remaining = limit != null ? Math.max(0, limit - used) : null;

    const rows: VendorMetricRow[] = [
      {
        vendor: "openrouter",
        metric: "usage_total_usd",
        value: used,
        metadata: { label: data?.label ?? null, isFreeTier: data?.is_free_tier ?? null },
      },
    ];
    if (limit != null) {
      rows.push({
        vendor: "openrouter",
        metric: "credit_limit_usd",
        value: limit,
        metadata: null,
      });
    }
    if (remaining != null) {
      rows.push({
        vendor: "openrouter",
        metric: "credit_remaining_usd",
        value: remaining,
        metadata: null,
      });
    }
    return rows;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] openrouter failed", { error: msg });
    return [{
      vendor: "openrouter",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * xAI Grok credit balance.
 * xAI has a public API; we expose the credit balance to admin to surface
 * "X scanning will fail soon" before it actually does.
 *
 * Endpoint: GET /v1/api-key — auth-bearer + returns API key info.
 * If xAI doesn't expose a balance endpoint cleanly, we just record the
 * key's redeem code / status so admin sees "valid" or "rate-limited".
 */
async function fetchXaiMetrics(): Promise<VendorMetricRow[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return [{
      vendor: "xai",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "XAI_API_KEY not set" },
    }];
  }

  try {
    // xAI's API surface for billing is not officially documented in detail.
    // We use the api-key info endpoint which surfaces team_id + key state.
    const res = await fetch("https://api.x.ai/v1/api-key", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`xAI /api-key HTTP ${res.status}`);
    }
    const body = await res.json();
    return [
      {
        vendor: "xai",
        metric: "key_active",
        value: body?.disabled ? 0 : 1,
        metadata: {
          name: body?.name ?? null,
          disabled: body?.disabled ?? null,
          acls: body?.acls ?? null,
          teamId: body?.team_id ?? null,
        },
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] xai failed", { error: msg });
    return [{
      vendor: "xai",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * Sentry: open unresolved issues + 24h event volume.
 * Endpoint: GET /api/0/projects/{org}/{project}/issues/?query=is:unresolved&statsPeriod=24h
 */
async function fetchSentryMetrics(): Promise<VendorMetricRow[]> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!token || !org || !project) {
    return [{
      vendor: "sentry",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT not set" },
    }];
  }

  try {
    const url = `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?query=is:unresolved&statsPeriod=24h&limit=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Sentry /issues HTTP ${res.status}`);
    }
    const issues = (await res.json()) as Array<{ id: string; title: string; count: string; level: string }>;
    const unresolvedCount = issues.length;
    const totalEvents24h = issues.reduce((sum, i) => sum + Number(i.count ?? 0), 0);
    const topIssue = issues[0] ?? null;

    return [
      {
        vendor: "sentry",
        metric: "unresolved_issues",
        value: unresolvedCount,
        metadata: topIssue
          ? { topIssueId: topIssue.id, topIssueTitle: topIssue.title, topIssueLevel: topIssue.level }
          : null,
      },
      {
        vendor: "sentry",
        metric: "events_last_24h",
        value: totalEvents24h,
        metadata: null,
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] sentry failed", { error: msg });
    return [{
      vendor: "sentry",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * Polar: active subscriptions count for our org.
 * Endpoint: GET /v1/subscriptions?organization_id=...&active=true
 */
async function fetchPolarMetrics(): Promise<VendorMetricRow[]> {
  const token = process.env.POLAR_ACCESS_TOKEN;
  const orgId = process.env.POLAR_ORG_ID;
  if (!token || !orgId) {
    return [{
      vendor: "polar",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "POLAR_ACCESS_TOKEN/POLAR_ORG_ID not set" },
    }];
  }

  try {
    const url = `https://api.polar.sh/v1/subscriptions?organization_id=${encodeURIComponent(orgId)}&active=true&limit=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Polar /subscriptions HTTP ${res.status}`);
    }
    const body = (await res.json()) as { items?: Array<{ status: string; product_id: string }>; pagination?: { total_count?: number } };
    const items = body?.items ?? [];
    const activeCount = body?.pagination?.total_count ?? items.length;
    // Per-product breakdown for tier-mix metadata.
    const byProduct = items.reduce<Record<string, number>>((acc, sub) => {
      const key = sub.product_id ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return [
      {
        vendor: "polar",
        metric: "active_subscriptions",
        value: activeCount,
        metadata: { byProduct },
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] polar failed", { error: msg });
    return [{
      vendor: "polar",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * Inngest: signing key authenticates against REST API for run inspection.
 * Endpoint: GET /v1/events?limit=1 — confirms key validity + returns recent events.
 * For deeper run health we'd query /v1/runs but that requires app_id; v1 is just
 * a connectivity + recent-event-count probe.
 */
async function fetchInngestMetrics(): Promise<VendorMetricRow[]> {
  const key = process.env.INNGEST_SIGNING_KEY;
  if (!key) {
    return [{
      vendor: "inngest",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "INNGEST_SIGNING_KEY not set" },
    }];
  }

  try {
    const res = await fetch("https://api.inngest.com/v1/events?limit=50", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Inngest /events HTTP ${res.status}`);
    }
    const body = (await res.json()) as { data?: unknown[] };
    const recentEventCount = Array.isArray(body?.data) ? body.data.length : 0;
    return [
      {
        vendor: "inngest",
        metric: "recent_events_count",
        value: recentEventCount,
        metadata: null,
      },
      {
        vendor: "inngest",
        metric: "api_reachable",
        value: 1,
        metadata: null,
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] inngest failed", { error: msg });
    return [{
      vendor: "inngest",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * Resend: 24h email send volume.
 * Endpoint: GET /emails — paginated list. We pull first page (default 50) and
 * count those with created_at within last 24h. Good enough for v1; if volume
 * grows past ~50/hr, switch to a counter table.
 */
async function fetchResendMetrics(): Promise<VendorMetricRow[]> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return [{
      vendor: "resend",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "RESEND_API_KEY not set" },
    }];
  }

  try {
    const res = await fetch("https://api.resend.com/emails?limit=100", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Resend /emails HTTP ${res.status}`);
    }
    const body = (await res.json()) as { data?: Array<{ created_at: string; last_event?: string }> };
    const emails = body?.data ?? [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = emails.filter((e) => new Date(e.created_at).getTime() >= cutoff);
    const bounced = last24h.filter((e) => e.last_event === "bounced").length;
    const complained = last24h.filter((e) => e.last_event === "complained").length;

    return [
      {
        vendor: "resend",
        metric: "emails_sent_24h",
        value: last24h.length,
        metadata: null,
      },
      {
        vendor: "resend",
        metric: "bounces_24h",
        value: bounced,
        metadata: null,
      },
      {
        vendor: "resend",
        metric: "complaints_24h",
        value: complained,
        metadata: null,
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] resend failed", { error: msg });
    return [{
      vendor: "resend",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * PostHog: DAU + key-event counts via HogQL.
 * Requires a PERSONAL API key (NEXT_PUBLIC_POSTHOG_KEY is write-only).
 * Skipped gracefully if POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID not set.
 */
async function fetchPostHogMetrics(): Promise<VendorMetricRow[]> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com";
  if (!apiKey || !projectId) {
    return [{
      vendor: "posthog",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "POSTHOG_PERSONAL_API_KEY/POSTHOG_PROJECT_ID not set" },
    }];
  }

  try {
    // HogQL: count distinct users in last 24h.
    const query = "SELECT count(DISTINCT distinct_id) FROM events WHERE timestamp > now() - INTERVAL 1 DAY";
    const res = await fetch(`${host}/api/projects/${encodeURIComponent(projectId)}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      throw new Error(`PostHog /query HTTP ${res.status}`);
    }
    const body = (await res.json()) as { results?: Array<Array<number>> };
    const dau = body?.results?.[0]?.[0] ?? 0;
    return [
      {
        vendor: "posthog",
        metric: "dau",
        value: Number(dau),
        metadata: null,
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] posthog failed", { error: msg });
    return [{
      vendor: "posthog",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * Langfuse: trace volume + p95 latency, last hour.
 * Endpoint: GET /api/public/traces?fromTimestamp=...
 * Auth: Basic with public:secret.
 */
async function fetchLangfuseMetrics(): Promise<VendorMetricRow[]> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";
  if (!publicKey || !secretKey) {
    return [{
      vendor: "langfuse",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY not set" },
    }];
  }

  try {
    const fromTs = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
    const res = await fetch(`${host}/api/public/traces?fromTimestamp=${encodeURIComponent(fromTs)}&limit=100`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Langfuse /traces HTTP ${res.status}`);
    }
    const body = (await res.json()) as { data?: Array<{ latency?: number }>; meta?: { totalItems?: number } };
    const traces = body?.data ?? [];
    const totalCount = body?.meta?.totalItems ?? traces.length;
    const latencies = traces
      .map((t) => Number(t.latency ?? 0))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : null;

    return [
      {
        vendor: "langfuse",
        metric: "traces_last_hour",
        value: totalCount,
        metadata: null,
      },
      {
        vendor: "langfuse",
        metric: "p95_latency_ms",
        value: p95 ?? null,
        metadata: { sampleSize: latencies.length },
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] langfuse failed", { error: msg });
    return [{
      vendor: "langfuse",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

/**
 * Vercel: last deployment status + build duration.
 * Endpoint: GET /v6/deployments?teamId=...&limit=1
 * Requires VERCEL_TOKEN (project-scoped or team-scoped).
 */
async function fetchVercelMetrics(): Promise<VendorMetricRow[]> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) {
    return [{
      vendor: "vercel",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: "VERCEL_TOKEN not set" },
    }];
  }

  try {
    const url = `https://api.vercel.com/v6/deployments?limit=1${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Vercel /deployments HTTP ${res.status}`);
    }
    const body = (await res.json()) as { deployments?: Array<{ state: string; ready?: number; createdAt: number; url: string; meta?: { githubCommitMessage?: string } }> };
    const latest = body?.deployments?.[0];
    if (!latest) {
      return [{
        vendor: "vercel",
        metric: "no_deployments_found",
        value: 1,
        metadata: null,
      }];
    }
    const buildMs = latest.ready && latest.createdAt ? latest.ready - latest.createdAt : null;
    return [
      {
        vendor: "vercel",
        metric: "last_deploy_state_ok",
        value: latest.state === "READY" ? 1 : 0,
        metadata: {
          state: latest.state,
          url: latest.url,
          commitMsg: latest.meta?.githubCommitMessage ?? null,
          ageSec: Math.round((Date.now() - latest.createdAt) / 1000),
        },
      },
      {
        vendor: "vercel",
        metric: "last_build_duration_ms",
        value: buildMs,
        metadata: null,
      },
    ];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn("[snapshot-vendor-metrics] vercel failed", { error: msg });
    return [{
      vendor: "vercel",
      metric: "_snapshot_failed",
      value: 1,
      metadata: { error: msg },
    }];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export const snapshotVendorMetrics = inngest.createFunction(
  {
    id: "snapshot-vendor-metrics",
    name: "Snapshot Vendor Metrics",
    retries: 2,
    timeouts: { finish: "5m" },
    concurrency: { limit: 1 },
  },
  { cron: "0 * * * *" }, // Every hour on the hour
  async ({ step }) => {
    const allRows: VendorMetricRow[] = [];

    // Run vendor fetches in parallel — independent APIs, no shared state.
    // step.run wraps each so Inngest retries are scoped per-vendor.
    const [apify, openrouter, xai, sentry, polar, inngestApi, resend, posthog, langfuse, vercel] = await Promise.all([
      step.run("fetch-apify", () => fetchApifyMetrics()),
      step.run("fetch-openrouter", () => fetchOpenRouterMetrics()),
      step.run("fetch-xai", () => fetchXaiMetrics()),
      step.run("fetch-sentry", () => fetchSentryMetrics()),
      step.run("fetch-polar", () => fetchPolarMetrics()),
      step.run("fetch-inngest", () => fetchInngestMetrics()),
      step.run("fetch-resend", () => fetchResendMetrics()),
      step.run("fetch-posthog", () => fetchPostHogMetrics()),
      step.run("fetch-langfuse", () => fetchLangfuseMetrics()),
      step.run("fetch-vercel", () => fetchVercelMetrics()),
    ]);
    allRows.push(...apify, ...openrouter, ...xai, ...sentry, ...polar, ...inngestApi, ...resend, ...posthog, ...langfuse, ...vercel);

    // Single batch insert. Real type for value/metadata aligns with schema.
    if (allRows.length > 0) {
      await step.run("insert-snapshots", async () => {
        await pooledDb.insert(vendorMetrics).values(
          allRows.map((r) => ({
            vendor: r.vendor,
            metric: r.metric,
            value: r.value,
            metadata: r.metadata,
          })),
        );
      });
    }

    return {
      vendorsSnapshotted: allRows.length,
      apifyRows: apify.length,
      openrouterRows: openrouter.length,
      xaiRows: xai.length,
      sentryRows: sentry.length,
      polarRows: polar.length,
      inngestRows: inngestApi.length,
      resendRows: resend.length,
      posthogRows: posthog.length,
      langfuseRows: langfuse.length,
      vercelRows: vercel.length,
    };
  },
);
