/**
 * Structural test: enforce that every API route either rate-limits requests
 * OR is explicitly allowlisted with a documented reason.
 *
 * Why this exists (Task 0.2 from .mdmp/kaulby-tier0-tier1-20260420.md):
 * Rate-limit gaps are an active abuse vector — authenticated-but-unthrottled
 * endpoints let a single compromised account or malicious insider burn
 * compute, enumerate resources, or scrape at will. Prior audit found 17
 * unprotected routes across 85 total. This test prevents that gap from
 * silently reopening in future PRs.
 *
 * The rule:
 *   Every src/app/api/**\/route.ts file must either
 *     (a) use checkApiRateLimit() or withApiAuth() (user-keyed limiter), OR
 *     (b) use checkAllRateLimits() (AI-specialized limiter, token-budget aware), OR
 *     (c) use checkIpRateLimit() (IP-keyed limiter for public endpoints), OR
 *     (d) appear in the ALLOWLIST below with a documented reason.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { globSync } from "glob";
import path from "path";

/**
 * Routes that intentionally skip per-request rate limiting.
 * Adding a route here requires a reason — don't add silently.
 */
const ALLOWLIST: Record<string, string> = {
  // Infra — must remain reachable under load for uptime monitoring
  "src/app/api/health/route.ts": "Public health check; must remain reachable under any load",

  // Inngest webhooks — signed by Inngest, rate-limited upstream by Inngest Cloud
  "src/app/api/inngest/route.ts": "Inngest-signed webhook; upstream rate-limited",
  "src/app/api/inngest/failure/route.ts": "Inngest-signed webhook; upstream rate-limited",

  // Third-party webhooks — HMAC/signature-verified; bursts are normal and expected
  "src/app/api/webhooks/clerk/route.ts": "Clerk webhook; svix-signed, legitimate bursts during user sync",
  "src/app/api/webhooks/email/route.ts": "Resend webhook; signature-verified, legitimate bursts during campaign sends",
  "src/app/api/webhooks/polar/route.ts": "Polar webhook; signature-verified, legitimate bursts during subscription events",

  // OAuth callbacks — short-lived code-exchange endpoints, state-validated.
  // Abuse is self-limiting (codes expire in seconds and are single-use).
  "src/app/api/integrations/slack/callback/route.ts": "OAuth callback; state-validated, single-use code",
  "src/app/api/integrations/hubspot/callback/route.ts": "OAuth callback; state-validated, single-use code",
  "src/app/api/integrations/discord/callback/route.ts": "OAuth callback; state-validated, single-use code",
};

/**
 * String patterns that indicate a file uses one of the approved rate-limit
 * primitives. Match on import statements or direct calls — either works.
 */
const APPROVED_PATTERNS = [
  /\bcheckApiRateLimit\b/, // @/lib/rate-limit — user-keyed
  /\bwithApiAuth\b/,        // @/lib/api-auth — API-key routes (internally rate-limited)
  /\bcheckAllRateLimits\b/, // @/lib/ai/rate-limit — AI-specialized
  /\bcheckIpRateLimit\b/,   // @/lib/rate-limit — IP-keyed for public endpoints
];

function findApiRoutes(): string[] {
  const repoRoot = path.resolve(__dirname, "../../..");
  const pattern = path.join(repoRoot, "src/app/api/**/route.ts");
  return globSync(pattern).map((p) => path.relative(repoRoot, p));
}

function fileUsesRateLimit(absPath: string): boolean {
  const content = readFileSync(absPath, "utf8");
  return APPROVED_PATTERNS.some((re) => re.test(content));
}

describe("API rate-limit coverage", () => {
  const routes = findApiRoutes();

  it("discovers every src/app/api/**/route.ts file", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it("every route either rate-limits or is allowlisted with a reason", () => {
    const gaps: string[] = [];
    const repoRoot = path.resolve(__dirname, "../../..");

    for (const relativePath of routes) {
      const normalized = relativePath.replace(/\\/g, "/");
      if (normalized in ALLOWLIST) continue;

      const absPath = path.join(repoRoot, relativePath);
      if (!fileUsesRateLimit(absPath)) {
        gaps.push(normalized);
      }
    }

    // Each gap is either a missing call or needs allowlisting with a reason.
    expect(gaps).toEqual([]);
  });

  it("allowlist entries point at real files (no stale allowlist drift)", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const missing: string[] = [];
    for (const relativePath of Object.keys(ALLOWLIST)) {
      try {
        readFileSync(path.join(repoRoot, relativePath), "utf8");
      } catch {
        missing.push(relativePath);
      }
    }
    expect(missing).toEqual([]);
  });
});
