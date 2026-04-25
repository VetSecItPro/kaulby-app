/**
 * Runtime environment validation.
 *
 * Why this exists (SEC-CFG-001):
 * Before this module, only DATABASE_URL was validated (in drizzle.config). The
 * app would boot fine with missing CLERK_WEBHOOK_SECRET / POLAR_WEBHOOK_SECRET
 * / ENCRYPTION_KEY / etc, and only fail at the first webhook delivery or first
 * decrypt — sometimes silently returning 401 to the payment provider.
 *
 * This module validates ALL required env vars at server boot. Fails fast
 * with a structured error message naming exactly which vars are missing or
 * malformed, so misconfiguration surfaces in the deploy log rather than at
 * the first inbound request.
 *
 * Usage: import { env } from '@/lib/env' anywhere on the server. The first
 * import triggers validation. Subsequent imports return the cached parsed
 * object.
 */

import { z } from "zod";

// We only validate. We don't reject placeholder-looking values, because
// .env.example placeholders are never loaded by Next.js — only .env.local /
// .env.production / Vercel env are. If anyone ever loads .env.example as a
// real env, that's a different bug class.
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Clerk auth
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_WEBHOOK_SECRET: z.string().min(1, "CLERK_WEBHOOK_SECRET is required for /api/webhooks/clerk"),

  // Polar payments
  POLAR_ACCESS_TOKEN: z.string().min(1, "POLAR_ACCESS_TOKEN is required"),
  POLAR_WEBHOOK_SECRET: z.string().min(1, "POLAR_WEBHOOK_SECRET is required for /api/webhooks/polar"),
  POLAR_ORG_ID: z.string().min(1, "POLAR_ORG_ID is required"),

  // Inngest
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),

  // Encryption
  ENCRYPTION_KEY: z
    .string()
    .min(64, "ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""),

  // AI
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),

  // Email
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),

  // Optional integrations — present in production but can be empty in dev
  XAI_API_KEY: z.string().optional(),
  APIFY_API_KEY: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),

  // Caching
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Sentry
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Observability — phase 5 alerts
  ADMIN_ALERT_EMAIL: z.string().email().optional(),

  // Node + framework
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ALLOW_DEV_AUTH_BYPASS: z.string().optional(),

  // Public URL
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * SEV-1 hot-fix 2026-04-25: env validation no longer throws in any
 * environment. Production was returning 500 on every dynamic route because
 * the strict Zod schema (specifically `ENCRYPTION_KEY: z.string().min(64)`)
 * was rejecting a real value, throwing during instrumentation.register(),
 * and crashing the Next.js runtime.
 *
 * Original intent (PR #279): "fail fast at boot when prod is misconfigured."
 * Real-world cost: a single overly-strict schema field can take down the
 * entire site. Worse than 401-ing one webhook at first request.
 *
 * New behavior — ALL environments:
 *   1. Run schema validation
 *   2. If validation fails, log structured error to stderr
 *   3. Return `process.env` cast as ServerEnv anyway
 *   4. Never throw, never crash boot
 *
 * The validation still surfaces misconfig in deploy logs (catchable by
 * Sentry / Vercel log monitoring). It just no longer blocks the server
 * from running. Future improvement: pipe these warnings into a Sentry
 * breadcrumb so misconfig drift is tracked without crashing production.
 */
function parseEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    const msg = `[env] Server environment validation failed (warn-only — server will still boot):\n${issues}`;
    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.error(msg);
    }
    return process.env as unknown as ServerEnv;
  }
  return result.data;
}

/**
 * Validated server-side env. Validation runs once on first access; subsequent
 * accesses use a cached object.
 *
 * Tests that need to import server modules (which transitively load env)
 * should set NODE_ENV=test in the test runner config so this object validates
 * in test mode without throwing on missing optional vars.
 */
export const env: ServerEnv = (() => {
  if (cached) return cached;
  // In test runs, skip validation but still type the object so test code can
  // safely reference fields without runtime crashes.
  if (process.env.NODE_ENV === "test") {
    cached = process.env as unknown as ServerEnv;
    return cached;
  }
  cached = parseEnv();
  return cached;
})();
