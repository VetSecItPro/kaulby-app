/**
 * AI Rate Limiting and Cost Control
 *
 * Prevents abuse and controls AI costs with:
 * - Per-user rate limiting (requests per minute/hour/day)
 * - Daily token budgets per tier
 * - Request caching for repeated questions
 * - Input validation and sanitization
 *
 * Uses Upstash Redis for distributed rate limiting when configured,
 * falls back to in-memory for local development.
 */

import { db, aiLogs } from "@/lib/db";
import { eq, gte, and, sql } from "drizzle-orm";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limits per tier (requests per time window)
const AI_RATE_LIMITS = {
  free: {
    requestsPerMinute: 0, // No AI access
    requestsPerHour: 0,
    requestsPerDay: 0,
    dailyTokenBudget: 0,
  },
  starter: {
    // COA 4 W3.2: between free and pro. Same model as Pro (Flash) so same per-call
    // cost shape, but tighter daily ceilings so $49/mo math still works.
    requestsPerMinute: 4,
    requestsPerHour: 20,
    requestsPerDay: 60,
    dailyTokenBudget: 30_000,
  },
  pro: {
    requestsPerMinute: 5,
    requestsPerHour: 30,
    requestsPerDay: 100,
    dailyTokenBudget: 50_000, // ~$0.15-0.50 depending on model
  },
  team: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 500,
    dailyTokenBudget: 200_000, // ~$0.60-2.00 depending on model
  },
} as const;

// COA 4 W1.8: per-user daily AI dollar cap (enforced via aiLogs.cost_usd sum).
// Protects against runaway costs when Team tier routes to Sonnet 4.5 ($3 in / $15 out).
// Overridable via env for emergency tuning without a deploy.
const DAILY_COST_CAPS_USD = {
  free: 0,
  starter: Number(process.env.KAULBY_STARTER_DAILY_AI_BUDGET_USD ?? 0.6),
  pro: Number(process.env.KAULBY_PRO_DAILY_AI_BUDGET_USD ?? 1),
  team: Number(process.env.KAULBY_TEAM_DAILY_AI_BUDGET_USD ?? 5),
} as const;

// ---------------------------------------------------------------------------
// Redis-backed rate limiters (distributed, survives restarts)
// ---------------------------------------------------------------------------

const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
);

function createRedisRatelimiter(
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`,
  maxRequests: number
): Ratelimit | null {
  if (!hasRedis || maxRequests === 0) return null;
  return new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
    }),
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix: "kaulby:ratelimit",
    analytics: false,
  });
}

// Lazy-initialized per-tier Redis rate limiters
let redisLimiters: Record<
  "starter" | "pro" | "team",
  { minute: Ratelimit | null; hour: Ratelimit | null; day: Ratelimit | null }
> | null = null;

function getRedisLimiters() {
  if (!redisLimiters) {
    redisLimiters = {
      starter: {
        minute: createRedisRatelimiter("1 m", AI_RATE_LIMITS.starter.requestsPerMinute),
        hour: createRedisRatelimiter("1 h", AI_RATE_LIMITS.starter.requestsPerHour),
        day: createRedisRatelimiter("1 d", AI_RATE_LIMITS.starter.requestsPerDay),
      },
      pro: {
        minute: createRedisRatelimiter("1 m", AI_RATE_LIMITS.pro.requestsPerMinute),
        hour: createRedisRatelimiter("1 h", AI_RATE_LIMITS.pro.requestsPerHour),
        day: createRedisRatelimiter("1 d", AI_RATE_LIMITS.pro.requestsPerDay),
      },
      team: {
        minute: createRedisRatelimiter("1 m", AI_RATE_LIMITS.team.requestsPerMinute),
        hour: createRedisRatelimiter("1 h", AI_RATE_LIMITS.team.requestsPerHour),
        day: createRedisRatelimiter("1 d", AI_RATE_LIMITS.team.requestsPerDay),
      },
    };
  }
  return redisLimiters;
}

// ---------------------------------------------------------------------------
// In-memory fallback (single instance, for local dev)
// ---------------------------------------------------------------------------

// PERF: Size-limited Map prevents unbounded growth if Redis fails — FIX-026
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_STORE_MAX = 10_000;

function checkRateLimitMemory(
  userId: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetAt: Date } {
  // PERF: Evict all entries if store grows too large — FIX-026
  if (rateLimitStore.size > RATE_LIMIT_STORE_MAX) {
    rateLimitStore.clear();
  }

  const key = `${userId}:${windowMs}`;
  const now = Date.now();

  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: new Date(now + windowMs) };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: new Date(existing.resetAt) };
  }

  existing.count++;
  return { allowed: true, remaining: maxRequests - existing.count, resetAt: new Date(existing.resetAt) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check all rate limits for a user.
 * Uses Upstash Redis when configured, in-memory fallback otherwise.
 */
export async function checkAllRateLimits(
  userId: string,
  tier: "free" | "starter" | "pro" | "team"
): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  const limits = AI_RATE_LIMITS[tier];

  if (limits.requestsPerMinute === 0) {
    return { allowed: false, reason: "AI features require a Starter subscription or higher" };
  }

  // --- Redis path (distributed) ---
  if (hasRedis && (tier === "starter" || tier === "pro" || tier === "team")) {
    const limiters = getRedisLimiters()[tier];

    const minuteResult = limiters.minute ? await limiters.minute.limit(`minute:${userId}`) : null;
    if (minuteResult && !minuteResult.success) {
      const retryAfter = Math.ceil((minuteResult.reset - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Rate limit exceeded. Try again in ${retryAfter} seconds`,
        retryAfter,
      };
    }

    const hourResult = limiters.hour ? await limiters.hour.limit(`hour:${userId}`) : null;
    if (hourResult && !hourResult.success) {
      const retryAfter = Math.ceil((hourResult.reset - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Hourly limit reached (${limits.requestsPerHour} requests/hour). Try again later.`,
        retryAfter,
      };
    }

    const dayResult = limiters.day ? await limiters.day.limit(`day:${userId}`) : null;
    if (dayResult && !dayResult.success) {
      const retryAfter = Math.ceil((dayResult.reset - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Daily limit reached (${limits.requestsPerDay} requests/day). Limit resets at midnight.`,
        retryAfter,
      };
    }

    return { allowed: true };
  }

  // --- In-memory fallback (local dev) ---
  const minuteCheck = checkRateLimitMemory(userId, 60_000, limits.requestsPerMinute);
  if (!minuteCheck.allowed) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Try again in ${Math.ceil((minuteCheck.resetAt.getTime() - Date.now()) / 1000)} seconds`,
      retryAfter: Math.ceil((minuteCheck.resetAt.getTime() - Date.now()) / 1000),
    };
  }

  const hourCheck = checkRateLimitMemory(userId, 3_600_000, limits.requestsPerHour);
  if (!hourCheck.allowed) {
    return {
      allowed: false,
      reason: `Hourly limit reached (${limits.requestsPerHour} requests/hour). Try again later.`,
      retryAfter: Math.ceil((hourCheck.resetAt.getTime() - Date.now()) / 1000),
    };
  }

  const dayCheck = checkRateLimitMemory(userId, 86_400_000, limits.requestsPerDay);
  if (!dayCheck.allowed) {
    return {
      allowed: false,
      reason: `Daily limit reached (${limits.requestsPerDay} requests/day). Limit resets at midnight.`,
      retryAfter: Math.ceil((dayCheck.resetAt.getTime() - Date.now()) / 1000),
    };
  }

  return { allowed: true };
}

/**
 * Get user's token usage for today
 */
async function getDailyTokenUsage(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${aiLogs.promptTokens} + ${aiLogs.completionTokens}), 0)`,
    })
    .from(aiLogs)
    .where(
      and(
        eq(aiLogs.userId, userId),
        gte(aiLogs.createdAt, startOfDay)
      )
    );

  return result[0]?.totalTokens || 0;
}

/**
 * Check if user has remaining token budget
 */
export async function checkTokenBudget(
  userId: string,
  tier: "free" | "starter" | "pro" | "team"
): Promise<{ allowed: boolean; remaining: number; used: number; limit: number }> {
  const limits = AI_RATE_LIMITS[tier];
  const used = await getDailyTokenUsage(userId);
  const remaining = Math.max(0, limits.dailyTokenBudget - used);

  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit: limits.dailyTokenBudget,
  };
}

/**
 * Get user's AI cost (USD) for today, summed from aiLogs.
 */
async function getDailyCostUsd(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalCost: sql<number>`COALESCE(SUM(${aiLogs.costUsd}), 0)`,
    })
    .from(aiLogs)
    .where(
      and(
        eq(aiLogs.userId, userId),
        gte(aiLogs.createdAt, startOfDay)
      )
    );

  return Number(result[0]?.totalCost ?? 0);
}

/**
 * COA 4 W1.8 — enforce a per-user $/day AI spend cap.
 *
 * Returns `allowed: false` when today's cumulative `aiLogs.cost_usd` for the
 * user has reached or exceeded the tier cap. Callers should halt new analysis
 * requests when this returns false, and optionally surface a notification so
 * the user knows why their scans paused (follow-up work — see backlog).
 *
 * Defaults: Pro $1/day, Team $5/day. Override at runtime via
 * `KAULBY_PRO_DAILY_AI_BUDGET_USD` / `KAULBY_TEAM_DAILY_AI_BUDGET_USD`.
 */
export async function checkDailyCostBudget(
  userId: string,
  tier: "free" | "starter" | "pro" | "team"
): Promise<{ allowed: boolean; spentUsd: number; capUsd: number; remainingUsd: number }> {
  const capUsd = DAILY_COST_CAPS_USD[tier];
  if (capUsd <= 0) {
    return { allowed: false, spentUsd: 0, capUsd: 0, remainingUsd: 0 };
  }

  const spentUsd = await getDailyCostUsd(userId);
  const remainingUsd = Math.max(0, capUsd - spentUsd);

  return {
    allowed: spentUsd < capUsd,
    spentUsd: Math.round(spentUsd * 10000) / 10000,
    capUsd,
    remainingUsd: Math.round(remainingUsd * 10000) / 10000,
  };
}

/**
 * Sanitize user input to prevent prompt injection
 */
export function sanitizeInput(input: string, maxLength: number = 2000): string {
  // SEC-LLM-01: Strip zero-width characters and normalize Unicode before pattern matching
  // Prevents bypassing filters via Unicode homoglyphs or invisible characters
  input = input.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');
  input = input.normalize('NFKC');

  // Remove potential prompt injection patterns
  let sanitized = input
    // Remove system/assistant role markers
    .replace(/\b(system|assistant|user):/gi, "[filtered]:")
    // Remove markdown code blocks that might contain instructions
    .replace(/```[\s\S]*?```/g, "[code block removed]")
    // Remove excessive whitespace
    .replace(/\s+/g, " ")
    // Trim
    .trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + "...";
  }

  return sanitized;
}

/**
 * Validate that input doesn't contain suspicious patterns
 */
export function validateInput(input: string): { valid: boolean; reason?: string } {
  // Check for empty input
  if (!input || input.trim().length === 0) {
    return { valid: false, reason: "Input cannot be empty" };
  }

  // Check for minimum length (prevents single-word abuse)
  if (input.trim().length < 5) {
    return { valid: false, reason: "Question is too short" };
  }

  // Check for suspicious patterns (potential jailbreak attempts)
  const suspiciousPatterns = [
    /ignore (?:all )?(?:previous |prior |above )?instructions/i,
    /forget (?:all )?(?:previous |prior |above )?instructions/i,
    /disregard (?:all )?(?:previous |prior |above )?instructions/i,
    /you are now/i,
    /pretend (?:to be|you are)/i,
    /act as (?:a|an|if)/i,
    /roleplay as/i,
    /system prompt/i,
    /reveal your instructions/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      return { valid: false, reason: "Invalid input detected" };
    }
  }

  return { valid: true };
}

/**
 * Simple cache for repeated questions (in-memory)
 * For production, use Redis
 */
const questionCache = new Map<string, { answer: string; citations: unknown[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedAnswer(userId: string, question: string): { answer: string; citations: unknown[] } | null {
  // Normalize question for cache key
  const cacheKey = `${userId}:${question.toLowerCase().trim()}`;
  const cached = questionCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { answer: cached.answer, citations: cached.citations };
  }

  // Clean up expired entry
  if (cached) {
    questionCache.delete(cacheKey);
  }

  return null;
}

export function cacheAnswer(userId: string, question: string, answer: string, citations: unknown[]): void {
  const cacheKey = `${userId}:${question.toLowerCase().trim()}`;
  questionCache.set(cacheKey, { answer, citations, timestamp: Date.now() });

  // Limit cache size (LRU-style cleanup)
  if (questionCache.size > 1000) {
    const firstKey = questionCache.keys().next().value;
    if (firstKey) questionCache.delete(firstKey);
  }
}

/**
 * Clean up old cache entries periodically
 */
function cleanupCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  questionCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => questionCache.delete(key));
}

// PERF: Only run cleanup interval outside Vercel serverless — FIX-002
if (typeof setInterval !== "undefined" && !process.env.VERCEL) {
  setInterval(cleanupCache, 5 * 60 * 1000);
}
