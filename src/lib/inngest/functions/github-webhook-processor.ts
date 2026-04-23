/**
 * GitHub webhook processor — async handler for `github/webhook.received` events.
 *
 * Companion to `src/app/api/webhooks/github/route.ts`. The receiver does
 * signature verify + enqueue only; this function does the actual ingestion:
 * match incoming events against the owning monitor's keywords, save matching
 * results to the `results` table, and trigger AI analysis.
 *
 * W2.5 scope: receiver passes `monitorId` when signature was verified against
 * a per-monitor secret. The processor uses that directly — no extra DB lookup
 * needed. When `monitorId` is null (env-secret fallback path), we log + drop
 * the event, since we have no workspace ownership to attribute results to.
 *
 * Handles: issues.opened, issue_comment.created, pull_request.opened,
 * pull_request_review_comment.created, discussion.created, discussion_comment.created.
 */

import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { captureEvent } from "@/lib/posthog";
import { pooledDb } from "@/lib/db";
import { monitors, results } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { contentMatchesMonitor } from "@/lib/content-matcher";
import { incrementResultsCount } from "@/lib/limits";

interface WebhookUserRef {
  login?: string;
}

interface IssuePayload {
  number?: number;
  title?: string;
  body?: string | null;
  html_url?: string;
  user?: WebhookUserRef;
  created_at?: string;
}

interface CommentPayload {
  body?: string | null;
  html_url?: string;
  user?: WebhookUserRef;
  created_at?: string;
}

interface PullRequestPayload {
  number?: number;
  title?: string;
  body?: string | null;
  html_url?: string;
  user?: WebhookUserRef;
  created_at?: string;
}

interface DiscussionPayload {
  number?: number;
  title?: string;
  body?: string | null;
  html_url?: string;
  user?: WebhookUserRef;
  created_at?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
}

interface NormalizedEvent {
  title: string;
  content: string;
  url: string;
  author: string;
  postedAt: Date;
}

function normalizeWebhookEvent(
  ghEvent: string,
  action: string | null,
  payload: Record<string, unknown>
): NormalizedEvent | null {
  if (ghEvent === "issues" && action === "opened") {
    const issue = asRecord(payload.issue) as IssuePayload;
    if (!issue.title || !issue.html_url) return null;
    return {
      title: issue.title,
      content: issue.body ?? "",
      url: issue.html_url,
      author: issue.user?.login ?? "unknown",
      postedAt: issue.created_at ? new Date(issue.created_at) : new Date(),
    };
  }

  if (ghEvent === "issue_comment" && action === "created") {
    const comment = asRecord(payload.comment) as CommentPayload;
    const issue = asRecord(payload.issue) as IssuePayload;
    if (!comment.body || !comment.html_url) return null;
    const title = issue.title ? `Comment on: ${issue.title}` : "Comment";
    return {
      title,
      content: comment.body,
      url: comment.html_url,
      author: comment.user?.login ?? "unknown",
      postedAt: comment.created_at ? new Date(comment.created_at) : new Date(),
    };
  }

  if (ghEvent === "pull_request" && action === "opened") {
    const pr = asRecord(payload.pull_request) as PullRequestPayload;
    if (!pr.title || !pr.html_url) return null;
    return {
      title: pr.title,
      content: pr.body ?? "",
      url: pr.html_url,
      author: pr.user?.login ?? "unknown",
      postedAt: pr.created_at ? new Date(pr.created_at) : new Date(),
    };
  }

  if (ghEvent === "pull_request_review_comment" && action === "created") {
    const comment = asRecord(payload.comment) as CommentPayload;
    const pr = asRecord(payload.pull_request) as PullRequestPayload;
    if (!comment.body || !comment.html_url) return null;
    const title = pr.title ? `PR review comment on: ${pr.title}` : "PR review comment";
    return {
      title,
      content: comment.body,
      url: comment.html_url,
      author: comment.user?.login ?? "unknown",
      postedAt: comment.created_at ? new Date(comment.created_at) : new Date(),
    };
  }

  if (ghEvent === "discussion" && action === "created") {
    const discussion = asRecord(payload.discussion) as DiscussionPayload;
    if (!discussion.title || !discussion.html_url) return null;
    return {
      title: discussion.title,
      content: discussion.body ?? "",
      url: discussion.html_url,
      author: discussion.user?.login ?? "unknown",
      postedAt: discussion.created_at ? new Date(discussion.created_at) : new Date(),
    };
  }

  if (ghEvent === "discussion_comment" && action === "created") {
    const comment = asRecord(payload.comment) as CommentPayload;
    const discussion = asRecord(payload.discussion) as DiscussionPayload;
    if (!comment.body || !comment.html_url) return null;
    const title = discussion.title ? `Discussion comment on: ${discussion.title}` : "Discussion comment";
    return {
      title,
      content: comment.body,
      url: comment.html_url,
      author: comment.user?.login ?? "unknown",
      postedAt: comment.created_at ? new Date(comment.created_at) : new Date(),
    };
  }

  return null;
}

export const githubWebhookProcessor = inngest.createFunction(
  {
    id: "github-webhook-processor",
    name: "GitHub webhook processor",
    retries: 3,
    timeouts: { finish: "2m" },
    // Capped at 5 to match Inngest free plan ceiling. Other Kaulby functions
    // (scan-on-demand, webhook-delivery, analyze-content, monitor-*) are also
    // at 5. Bumping requires upgrading the Inngest plan first.
    concurrency: { limit: 5 },
  },
  { event: "github/webhook.received" },
  async ({ event, step }) => {
    const {
      event: ghEvent,
      deliveryId,
      installationId,
      repoFullName,
      action,
      monitorId,
      userId,
      payload,
    } = event.data;

    logger.info("[github-webhook-processor] received", {
      event: ghEvent,
      deliveryId,
      action,
      repoFullName,
      installationId,
      monitorId,
    });

    captureEvent({
      distinctId: userId ?? `github-installation-${installationId ?? "unknown"}`,
      event: "github_webhook.received",
      properties: {
        github_event: ghEvent,
        action,
        repo: repoFullName,
        delivery_id: deliveryId,
        monitor_bound: Boolean(monitorId),
      },
    });

    if (!monitorId || !userId) {
      logger.warn("[github-webhook-processor] no monitor context — dropping", {
        deliveryId,
        repoFullName,
      });
      return { handled: "no-monitor-context", deliveryId };
    }

    const normalized = normalizeWebhookEvent(ghEvent, action, payload);
    if (!normalized) {
      return { handled: "unsupported-event-shape", event: ghEvent, action, deliveryId };
    }

    const monitor = await step.run(`load-monitor-${monitorId}`, async () => {
      const rows = await pooledDb
        .select({
          id: monitors.id,
          userId: monitors.userId,
          name: monitors.name,
          keywords: monitors.keywords,
          companyName: monitors.companyName,
          searchQuery: monitors.searchQuery,
          isActive: monitors.isActive,
        })
        .from(monitors)
        .where(and(eq(monitors.id, monitorId), eq(monitors.isActive, true)))
        .limit(1);
      return rows[0] ?? null;
    });

    if (!monitor) {
      logger.info("[github-webhook-processor] monitor gone or paused", {
        monitorId,
        deliveryId,
      });
      return { handled: "monitor-unavailable", deliveryId, monitorId };
    }

    const match = contentMatchesMonitor(
      {
        title: normalized.title,
        body: normalized.content,
        author: normalized.author,
      },
      {
        companyName: monitor.companyName,
        keywords: monitor.keywords,
        searchQuery: monitor.searchQuery,
      }
    );

    if (!match.matches) {
      return {
        handled: "no-match",
        deliveryId,
        monitorId: monitor.id,
        event: ghEvent,
        action,
      };
    }

    const existing = await step.run(`dedup-${deliveryId}`, async () => {
      const rows = await pooledDb
        .select({ sourceUrl: results.sourceUrl })
        .from(results)
        .where(
          and(
            eq(results.monitorId, monitor.id),
            inArray(results.sourceUrl, [normalized.url])
          )
        )
        .limit(1);
      return rows.length > 0;
    });

    if (existing) {
      return { handled: "duplicate", deliveryId, monitorId: monitor.id };
    }

    const inserted = await step.run(`insert-${deliveryId}`, async () => {
      return pooledDb
        .insert(results)
        .values({
          monitorId: monitor.id,
          platform: "github" as const,
          sourceUrl: normalized.url,
          title: normalized.title,
          content: normalized.content,
          author: normalized.author,
          postedAt: normalized.postedAt,
          metadata: {
            githubEvent: ghEvent,
            githubAction: action,
            repoFullName,
            deliveryId,
          },
        })
        .returning({ id: results.id });
    });

    if (inserted.length === 0) {
      return { handled: "insert-failed", deliveryId, monitorId: monitor.id };
    }

    await step.run(`increment-usage-${deliveryId}`, async () => {
      await incrementResultsCount(monitor.userId, 1);
    });

    await step.run(`trigger-analysis-${deliveryId}`, async () => {
      await inngest.send({
        name: "content/analyze" as const,
        data: { resultId: inserted[0].id, userId: monitor.userId },
      });
    });

    logger.info("[github-webhook-processor] ingested", {
      deliveryId,
      monitorId: monitor.id,
      resultId: inserted[0].id,
      event: ghEvent,
      action,
    });

    return {
      handled: "ingested",
      deliveryId,
      monitorId: monitor.id,
      resultId: inserted[0].id,
    };
  }
);
