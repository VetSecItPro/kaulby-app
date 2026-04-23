/**
 * Per-monitor GitHub webhook secret generation.
 *
 * Kaulby monitors that watch a GitHub repo carry a per-monitor HMAC secret
 * (COA 4 W2.5). When a user configures the webhook, we generate a fresh
 * 32-byte hex string, store it on the monitor row, and display it to the
 * user ONCE during setup so they can paste it into GitHub's Settings →
 * Webhooks.
 *
 * Secret lifecycle:
 *  - Generated once per monitor via `generateGitHubWebhookSecret()`
 *  - Stored in `monitors.github_webhook_secret` (nullable text)
 *  - Shown to the user in the initial setup view, never again in plain
 *  - Never logged, never returned in monitor-list API responses
 *  - Rotated by regenerating — user must update the GitHub-side secret too
 */

import { randomBytes } from "crypto";

/** Generate a fresh 32-byte hex secret suitable for GitHub webhook HMAC. */
export function generateGitHubWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/** Minimal format check: 64 hex chars (32 bytes). Never logs content. */
export function looksLikeGitHubWebhookSecret(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}
