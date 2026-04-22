/**
 * GitHub webhook receiver — COA 4 W2.4.
 *
 * Responsibility: verify HMAC-SHA256 signature, parse the event envelope,
 * fan out to Inngest for async processing, and return 200 as fast as possible.
 * GitHub retries deliveries that exceed a 10-second response budget (and does
 * not auto-retry after that), so we do NOT do any DB work or AI analysis inline.
 *
 * Event handling lives in `src/lib/inngest/functions/github-webhook-processor.ts`.
 * Signature verification lives in `src/lib/github-webhook-verify.ts`.
 * Runbook: `.github/runbooks/github-webhooks.md`.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyGitHubSignature } from "@/lib/github-webhook-verify";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // GitHub delivery budget is 10s; we aim for <1s.

// Events Kaulby cares about. Anything else is ack'd with 200 but ignored.
// Kept small to limit processing surface; add to this list when new handlers ship.
const SUPPORTED_EVENTS = new Set([
  "issues",
  "issue_comment",
  "pull_request",
  "pull_request_review_comment",
  "discussion",
  "discussion_comment",
  // `ping` is GitHub's "I just configured this webhook" probe — always accept.
  "ping",
]);

interface GitHubEventPayload {
  action?: string;
  repository?: { full_name?: string };
  installation?: { id?: number };
}

export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    // Configuration error — don't accept deliveries we can't validate.
    logger.error("[github-webhook] GITHUB_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook receiver not configured" },
      { status: 500 }
    );
  }

  // IMPORTANT: read raw body text, not parsed JSON. The HMAC is computed over
  // the exact bytes GitHub sent; re-serializing JSON would change whitespace
  // and invalidate the signature.
  const rawBody = await request.text();

  const hdrs = await headers();
  const signature = hdrs.get("x-hub-signature-256");
  const eventName = hdrs.get("x-github-event");
  const deliveryId = hdrs.get("x-github-delivery");

  if (!verifyGitHubSignature(rawBody, signature, secret)) {
    logger.warn("[github-webhook] signature verification failed", {
      eventName,
      deliveryId,
      hasSignature: Boolean(signature),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!eventName) {
    return NextResponse.json({ error: "Missing X-GitHub-Event" }, { status: 400 });
  }

  // Ack unsupported events without fanning out — keeps Inngest throughput clean.
  if (!SUPPORTED_EVENTS.has(eventName)) {
    logger.debug("[github-webhook] ignoring unsupported event", { eventName, deliveryId });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // GitHub's "ping" event confirms receiver is reachable; no fan-out needed.
  if (eventName === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  // Parse payload — we already validated its bytes via the signature check.
  let payload: GitHubEventPayload & Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    logger.warn("[github-webhook] invalid JSON body despite valid signature", {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  try {
    await inngest.send({
      name: "github/webhook.received",
      data: {
        event: eventName,
        deliveryId: deliveryId ?? "unknown",
        installationId: payload.installation?.id ?? null,
        repoFullName: payload.repository?.full_name ?? null,
        action: payload.action ?? null,
        payload,
      },
    });
  } catch (err) {
    // If Inngest itself is down we still want GitHub to retry on its next
    // delivery; return 500 so the delivery shows as failed in GitHub's UI.
    logger.error("[github-webhook] failed to enqueue Inngest event", {
      deliveryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Enqueue failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
