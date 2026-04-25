/**
 * Hourly cron: snapshot key external-vendor metrics into our DB.
 *
 * Why: admin dashboard at /manage/observability/vendors reads from
 * vendor_metrics instead of hitting Apify/OpenRouter/xAI APIs on every
 * page load. Decouples admin UX from vendor API availability + rate limits.
 *
 * v1 covers the cost-heavy vendors only:
 * - Apify (account quota — main cost concern, exhausted today)
 * - OpenRouter (account credits — primary AI billing)
 * - xAI Grok (account credits — X-platform scraping)
 *
 * Future: add Sentry, Polar, Inngest, Vercel, PostHog, Langfuse, Resend.
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
    const [apify, openrouter, xai] = await Promise.all([
      step.run("fetch-apify", () => fetchApifyMetrics()),
      step.run("fetch-openrouter", () => fetchOpenRouterMetrics()),
      step.run("fetch-xai", () => fetchXaiMetrics()),
    ]);
    allRows.push(...apify, ...openrouter, ...xai);

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
    };
  },
);
