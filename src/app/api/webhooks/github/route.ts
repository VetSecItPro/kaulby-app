/**
 * GitHub webhook receiver — COA 4 W2.4 (receiver) + W2.5 (per-monitor auth).
 *
 * Responsibility: verify HMAC-SHA256 signature, parse the event envelope,
 * fan out to Inngest for async processing, and return 200 as fast as possible.
 * GitHub retries deliveries that exceed a 10-second response budget (and does
 * not auto-retry after that), so we do NOT do any DB work or AI analysis inline.
 *
 * W2.5 security model: users configure webhooks per-monitor. Each Kaulby monitor
 * with a GitHub repo stores its own `githubWebhookSecret`; the user copies that
 * into their repo's Settings → Webhooks. On incoming delivery:
 *   1. Parse body to extract `repository.full_name`
 *   2. Look up the monitor whose `githubRepoFullName` matches
 *   3. If found AND monitor has a secret → verify against THAT secret
 *   4. Otherwise → fall back to the `GITHUB_WEBHOOK_SECRET` env var (legacy path)
 *   5. If neither verifies → 401
 *
 * Why this is safe: the attacker controls the `repository.full_name` in their
 * forged payload, but cannot produce a valid HMAC without the real monitor's
 * secret (which they don't have). Looking up a monitor by an attacker-supplied
 * repo name is a read-only parameterized query via Drizzle — no SQL-injection
 * vector — and worst case it fetches a secret the attacker can't use anyway.
 *
 * Event handling lives in `src/lib/inngest/functions/github-webhook-processor.ts`.
 * Signature verification lives in `src/lib/github-webhook-verify.ts`.
 * Runbook: `.github/runbooks/github-webhooks.md`.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { pooledDb } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { verifyGitHubSignature } from "@/lib/github-webhook-verify";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // GitHub delivery budget is 10s; we aim for <1s.

// Events Kaulby cares about. Anything else is ack'd with 200 but ignored.
const SUPPORTED_EVENTS = new Set([
  "issues",
  "issue_comment",
  "pull_request",
  "pull_request_review_comment",
  "discussion",
  "discussion_comment",
  "ping",
]);

interface GitHubEventPayload {
  action?: string;
  repository?: { full_name?: string };
  installation?: { id?: number };
}

export async function POST(request: NextRequest) {
  const envSecret = process.env.GITHUB_WEBHOOK_SECRET;

  // Raw body captured before any parsing — HMAC must be computed over the
  // exact bytes GitHub sent, or signature verification fails.
  const rawBody = await request.text();

  const hdrs = await headers();
  const signature = hdrs.get("x-hub-signature-256");
  const eventName = hdrs.get("x-github-event");
  const deliveryId = hdrs.get("x-github-delivery");

  if (!eventName) {
    return NextResponse.json({ error: "Missing X-GitHub-Event" }, { status: 400 });
  }

  // Parse payload up-front so we can extract the repo name for per-monitor
  // secret lookup. Parsing BEFORE signature verification looks suspicious at
  // first glance, but we never trust the parsed content until after verify —
  // we only use `repository.full_name` as a key to look up a Kaulby-owned
  // secret. An attacker can lie about the repo, but can't forge the HMAC.
  let payload: GitHubEventPayload & Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    logger.warn("[github-webhook] invalid JSON body", {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const repoFullName = payload.repository?.full_name ?? null;

  // Resolve which secret to verify against.
  let signingSecret: string | null = null;
  let monitorId: string | null = null;
  let userId: string | null = null;

  if (repoFullName) {
    try {
      const row = await pooledDb
        .select({
          id: monitors.id,
          userId: monitors.userId,
          secret: monitors.githubWebhookSecret,
        })
        .from(monitors)
        .where(
          and(
            eq(monitors.githubRepoFullName, repoFullName),
            eq(monitors.isActive, true)
          )
        )
        .limit(1);
      const monitor = row[0];
      if (monitor?.secret) {
        signingSecret = monitor.secret;
        monitorId = monitor.id;
        userId = monitor.userId;
      }
    } catch (err) {
      // DB lookup failure is logged but doesn't block the delivery — we fall
      // through to the env secret.
      logger.warn("[github-webhook] monitor lookup failed", {
        repoFullName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fall back to env-level secret when no matching monitor secret was found.
  if (!signingSecret && envSecret) {
    signingSecret = envSecret;
  }

  if (!signingSecret) {
    // No per-monitor secret AND no env secret — misconfiguration.
    logger.error("[github-webhook] no signing secret available", {
      repoFullName,
      deliveryId,
      hasEnvSecret: Boolean(envSecret),
    });
    return NextResponse.json(
      { error: "Webhook receiver not configured for this repo" },
      { status: 500 }
    );
  }

  if (!verifyGitHubSignature(rawBody, signature, signingSecret)) {
    logger.warn("[github-webhook] signature verification failed", {
      eventName,
      deliveryId,
      repoFullName,
      hasSignature: Boolean(signature),
      usedMonitorSecret: Boolean(monitorId),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Ack unsupported events without fanning out — keeps Inngest throughput clean.
  if (!SUPPORTED_EVENTS.has(eventName)) {
    logger.debug("[github-webhook] ignoring unsupported event", { eventName, deliveryId });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // GitHub's "ping" event confirms receiver is reachable; no fan-out needed.
  if (eventName === "ping") {
    return NextResponse.json({
      ok: true,
      pong: true,
      monitorBound: Boolean(monitorId),
    });
  }

  try {
    await inngest.send({
      name: "github/webhook.received",
      data: {
        event: eventName,
        deliveryId: deliveryId ?? "unknown",
        installationId: payload.installation?.id ?? null,
        repoFullName,
        action: payload.action ?? null,
        // W2.5: when signature was verified against a monitor-owned secret,
        // pass the monitor id downstream so the processor can match directly
        // without re-querying.
        monitorId,
        userId,
        payload,
      },
    });
  } catch (err) {
    logger.error("[github-webhook] failed to enqueue Inngest event", {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Enqueue failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
