# GitHub Webhooks Runbook for Real-Time Community Monitoring

## Overview

GitHub webhooks enable Kaulby to replace polling-based monitoring with event-driven, real-time ingestion of issues, pull requests, discussions, and comments from users' repositories. This runbook covers the technical setup required to implement webhook-based collection for Team-tier users.

**Reference:** [GitHub Webhooks Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)

## Webhook Events

Kaulby should subscribe to the following GitHub webhook events:

| Event | Actions | Use Case |
|-------|---------|----------|
| `issues` | opened, closed, edited, labeled, unlabeled, assigned, unassigned, locked, unlocked | Issue creation, updates, status changes |
| `pull_request` | opened, closed, edited, labeled, unlabeled, assigned, unassigned, synchronize, ready_for_review | PR creation, updates, status changes |
| `issue_comment` | created, edited, deleted | Comments on issues |
| `pull_request_review_comment` | created, edited, deleted | Comments on PRs (in-line reviews) |
| `discussion` | created, closed, edited, labeled, unlabeled, answered | GitHub Discussions posts |
| `discussion_comment` | created, edited, deleted | Comments on discussions |

**Reference:** [Webhook Events and Payloads](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads)

## Payload Structure

Each webhook delivers a JSON payload with:

- **Top-level fields**: `action` (what happened), `repository` (the repo, including owner/name), `sender` (who triggered the event), `installation` (GitHub App installation ID)
- **Event-specific objects**:
  - `issues` events include `issue` object (title, body, state, labels, created_at)
  - `pull_request` events include `pull_request` object (title, body, state, created_at)
  - `issue_comment` and `pull_request_review_comment` include `comment` object (body, created_at, author)
  - `discussion` events include `discussion` object (title, body, state)
  - `discussion_comment` includes `comment` object

**Example:** `issues` / `opened` action:
```json
{
  "action": "opened",
  "issue": {
    "id": 2,
    "number": 1,
    "title": "Found a bug",
    "body": "I'm having trouble...",
    "state": "open",
    "created_at": "2024-03-15T10:00:00Z",
    "labels": [{"name": "bug"}]
  },
  "repository": {
    "id": 1296269,
    "name": "Hello-World",
    "full_name": "octocat/Hello-World"
  },
  "sender": {
    "login": "octocat",
    "id": 1
  },
  "installation": {
    "id": 12345
  }
}
```

## Authentication & Signature Verification

GitHub signs all webhook payloads using HMAC-SHA256. The signature appears in the `X-Hub-Signature-256` request header as `sha256=<hex_digest>`.

**Verification process:**

1. Extract the raw request body (byte-for-byte)
2. Calculate expected signature: `HMAC-SHA256(webhook_secret, body)`
3. Compare with header value using **constant-time comparison** (e.g., `crypto.timingSafeEqual` in Node.js)
4. Reject if mismatch

**Example (Node.js):**
```typescript
import crypto from 'crypto';

export function verifyGitHubSignature(
  payload: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

**Reference:** [Securing Your Webhooks](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)

## Installation Model: GitHub App

For a SaaS ingesting events from many users' repos, use a **GitHub App** with **installation webhooks**:

- **Why GitHub App?** Apps can be installed across multiple repositories and organizations. Each installation has its own webhook secret and installation ID, enabling per-customer isolation.
- **Installation flow:** Users authorize the app on their repository/organization. Kaulby receives an `installation` event with the installation ID, which is stored in the database and mapped to the user's workspace/account.
- **Permissions:** Request "Read" access to:
  - Issues (`issues: read`)
  - Pull Requests (`pull_requests: read`)
  - Discussions (`discussions: read`)

No write permissions needed for read-only monitoring.

**References:**
- [GitHub Apps Overview](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-github-apps)
- [Choosing Permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
- [Using Webhooks with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)

## Delivery Reliability & Rate Limits

**Delivery:**
- GitHub delivers webhooks with a 10-second timeout. If your endpoint doesn't respond within 10 seconds, the delivery is recorded as failed.
- GitHub **does not automatically retry** failed deliveries. Failed deliveries can be manually redelivered via the GitHub dashboard or programmatically via the REST API.

**Rate limiting:**
- Very active repositories may trigger webhook throttling; GitHub may temporarily slow delivery if surge is detected.
- Max 20 webhooks per event type per repository/organization.

**Kaulby mitigation:** Queue all webhook payloads to Inngest or Redis immediately upon receipt (respond 200 within <1s), then hand off analysis/ingestion to background workers. This decouples delivery from processing and ensures GitHub sees timely ACKs.

**References:**
- [Handling Failed Webhook Deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)
- [Troubleshooting Webhooks](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks)

## Recommended Kaulby Implementation

**Install a GitHub App** on Kaulby's organization account and allow users to authorize it on their repositories. The app requests read-only access to issues, pull requests, and discussions. On installation, store the installation ID and webhook secret in the `integrations` table (keyed to workspace + installation_id). Create an `/api/webhooks/github` endpoint that:

1. Validates the `X-Hub-Signature-256` signature using constant-time comparison
2. Routes the payload to Inngest as a new event (e.g., `github.issue.opened`, `github.pull_request.created`, `github.comment.created`)
3. Immediately returns `200 OK` to GitHub (response time <1s)
4. In the worker, ingest the webhook payload into the `results` table (similar to existing poll-based flow), then trigger AI sentiment analysis via the same downstream analysis Inngest function used by polling

This gives real-time alerts for Team-tier users while reusing the existing AI analysis pipeline. For users without the GitHub App installed, polling continues as fallback.

---

**Created:** 2026-04-22 (COA 4 W1.2 research output)
**Source:** `.mdmp/kaulby-intelligence-upgrade-coa4-20260421.md` Week 2 Phase 2.2 (GitHub real-time)
