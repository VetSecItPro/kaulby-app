/**
 * POST /api/monitors/[id]/github-webhook/rotate
 *
 * Generates a fresh GitHub webhook secret for the monitor and stores it.
 * Returns the new secret in the response body - this is the ONLY time the
 * caller will see it. After a rotation, the previous secret is invalidated
 * immediately; the user must update their GitHub webhook config with the
 * new value within GitHub's 10-second retry window.
 *
 * Prereq: monitor must have `githubRepoFullName` set. We don't let callers
 * generate a secret for a repo-less monitor because the receiver keys on
 * the repo name during signature lookup.
 *
 * Scope: auth-gated by Clerk via middleware. Write rate-limited per-user.
 * Never logged in plaintext. Response uses no-store cache headers.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getEffectiveUserId } from "@/lib/dev-auth";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { generateGitHubWebhookSecret } from "@/lib/github-webhook-secret";
import { logger } from "@/lib/logger";
import { logError } from "@/lib/error-logger";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void request;
  try {
    const userId = await getEffectiveUserId();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } }
      );
    }

    const existing = await db.query.monitors.findFirst({
      where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
    }

    if (!existing.githubRepoFullName) {
      return NextResponse.json(
        {
          error: "Set a GitHub repo on this monitor before generating a webhook secret.",
        },
        { status: 400 }
      );
    }

    const secret = generateGitHubWebhookSecret();

    await db
      .update(monitors)
      .set({ githubWebhookSecret: secret, updatedAt: new Date() })
      .where(and(eq(monitors.id, id), eq(monitors.userId, userId)));

    // Intentionally NOT logging the secret. Include monitor id + repo only.
    logger.info("[github-webhook-rotate] secret rotated", {
      monitorId: id,
      userId,
      repo: existing.githubRepoFullName,
    });

    // Build the caller-facing webhook URL so the UI can display one string
    // the user copies straight into GitHub's config page.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
    const webhookUrl = appUrl ? `${appUrl}/api/webhooks/github` : "/api/webhooks/github";

    return NextResponse.json(
      {
        secret,
        webhookUrl,
        repo: existing.githubRepoFullName,
        monitorId: id,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      }
    );
  } catch (error) {
    logger.error("Error rotating GitHub webhook secret:", {
      error: error instanceof Error ? error.message : String(error),
    });
    logError({
      source: "api",
      message: "Failed to rotate GitHub webhook secret",
      error,
      endpoint: "POST /api/monitors/[id]/github-webhook/rotate",
    });
    return NextResponse.json(
      { error: "Failed to rotate webhook secret" },
      { status: 500 }
    );
  }
}
