/**
 * GitHub webhook processor — async handler for `github/webhook.received` events.
 *
 * Companion to `src/app/api/webhooks/github/route.ts`. The receiver does
 * signature verify + enqueue only; this function does the actual ingestion:
 * match incoming events against active GitHub monitors' keywords, save
 * matching results to the `results` table, and trigger AI analysis.
 *
 * Scope boundary (2026-04-22, W2.4): this ships a minimal viable processor
 * that handles `issues` + `issue_comment` (the most common signals). W2.5
 * adds per-user GitHub App installation wiring so we know WHICH workspaces
 * own a given repository. Until W2.5 lands, the processor is best-effort —
 * it logs unmatched events for later replay but does not write results.
 */

import { inngest } from "../client";
import { logger } from "@/lib/logger";
import { captureEvent } from "@/lib/posthog";

interface IssuePayload {
  title?: string;
  body?: string | null;
  html_url?: string;
  user?: { login?: string };
  created_at?: string;
}

interface CommentPayload {
  body?: string | null;
  html_url?: string;
  user?: { login?: string };
  created_at?: string;
}

// Type guard for arbitrary keys on a payload object (webhook shape is huge).
function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
}

export const githubWebhookProcessor = inngest.createFunction(
  {
    id: "github-webhook-processor",
    name: "GitHub webhook processor",
    retries: 3,
    timeouts: { finish: "2m" },
    concurrency: { limit: 10 },
  },
  { event: "github/webhook.received" },
  async ({ event, step }) => {
    const { event: ghEvent, deliveryId, installationId, repoFullName, action, payload } = event.data;

    logger.info("[github-webhook-processor] received", {
      event: ghEvent,
      deliveryId,
      action,
      repoFullName,
      installationId,
    });

    // Emit a PostHog event for every delivery so the dashboard can show
    // webhook throughput + action distribution without a dedicated query.
    captureEvent({
      distinctId: `github-installation-${installationId ?? "unknown"}`,
      event: "github_webhook.received",
      properties: {
        github_event: ghEvent,
        action,
        repo: repoFullName,
        delivery_id: deliveryId,
      },
    });

    // Branch on event type. We only handle a narrow set today; everything else
    // is logged + acknowledged. Unsupported events already got filtered by the
    // receiver, but future route changes might open the gate wider so we still
    // guard here.
    if (ghEvent === "issues" && action === "opened") {
      const issue = asRecord(payload.issue) as IssuePayload;
      const text = [issue.title, issue.body ?? ""].filter(Boolean).join("\n\n");
      const url = issue.html_url ?? "";
      logger.debug("[github-webhook-processor] issue opened", {
        deliveryId,
        repo: repoFullName,
        url,
        hasBody: Boolean(issue.body),
      });
      // W2.5 adds workspace lookup + keyword match + result insert.
      // Placeholder step keeps the Inngest dashboard showing this path exists.
      await step.run("match-issue-stub", async () => ({ matched: false, reason: "W2.5 pending" }));
      // Silence unused-var warning for text until W2.5 wires the match.
      void text;
      return { handled: "issues.opened", deliveryId, matchSaved: false };
    }

    if (ghEvent === "issue_comment" && action === "created") {
      const comment = asRecord(payload.comment) as CommentPayload;
      logger.debug("[github-webhook-processor] issue comment created", {
        deliveryId,
        repo: repoFullName,
        url: comment.html_url,
      });
      await step.run("match-comment-stub", async () => ({ matched: false, reason: "W2.5 pending" }));
      return { handled: "issue_comment.created", deliveryId, matchSaved: false };
    }

    // pull_request + discussion + discussion_comment will follow the same
    // pattern once W2.5 ships the installation→workspace lookup.
    return { handled: "logged-only", event: ghEvent, action, deliveryId };
  }
);
