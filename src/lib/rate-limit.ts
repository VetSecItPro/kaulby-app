/**
 * General API Rate Limiting and Body Size Limits
 *
 * Prevents abuse with per-user rate limiting by operation type:
 * - read (GET): 60 requests/minute
 * - write (POST/PATCH/DELETE): 20 requests/minute
 * - export (heavy operations): 5 requests/minute
 *
 * Uses Upstash Redis when configured, in-memory fallback for local dev.
 * Separate from AI rate limiting (src/lib/ai/rate-limit.ts).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limit tiers by operation type
const API_RATE_LIMITS = {
  read: { requests: 60, window: "1 m" as const },
  write: { requests: 20, window: "1 m" as const },
  export: { requests: 5, window: "1 m" as const },
};

type RateLimitType = keyof typeof API_RATE_LIMITS;

// Default body size limit: 100KB
const DEFAULT_MAX_BODY_BYTES = 102_400;

// ---------------------------------------------------------------------------
// Redis-backed rate limiters
// ---------------------------------------------------------------------------

const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
);

function createLimiter(type: RateLimitType): Ratelimit | null {
  if (!hasRedis) return null;
  const config = API_RATE_LIMITS[type];
  return new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
    }),
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    prefix: "kaulby:api-rate",
    analytics: false,
  });
}

// Lazy-initialized limiters
let limiters: Record<RateLimitType, Ratelimit | null> | null = null;

function getLimiters() {
  if (!limiters) {
    limiters = {
      read: createLimiter("read"),
      write: createLimiter("write"),
      export: createLimiter("export"),
    };
  }
  return limiters;
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { count: number; resetAt: number }>();
const MEMORY_STORE_MAX = 10_000;

function checkMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  if (memoryStore.size > MEMORY_STORE_MAX) {
    memoryStore.clear();
  }

  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  existing.count++;
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check API rate limit for a user by operation type.
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
 */
export async function checkApiRateLimit(
  userId: string,
  type: RateLimitType
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = API_RATE_LIMITS[type];

  // Redis path
  const limiter = getLimiters()[type];
  if (limiter) {
    try {
      const result = await limiter.limit(`${type}:${userId}`);
      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
      }
      return { allowed: true };
    } catch {
      // Redis error — fall through to in-memory
    }
  }

  // In-memory fallback
  return checkMemory(`${type}:${userId}`, config.requests, 60_000);
}

/**
 * Check request body size against a limit.
 * Reads Content-Length header for a fast pre-check.
 */
export function checkBodySize(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): { ok: boolean; size: number } {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > maxBytes) {
      return { ok: false, size };
    }
    return { ok: true, size: size || 0 };
  }
  // No Content-Length header — allow (actual size checked in parseJsonBody)
  return { ok: true, size: 0 };
}

/**
 * Parse JSON body with size limit enforcement.
 * Combines Content-Length pre-check + actual body length validation.
 * Throws a typed error on size violation or invalid JSON.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseJsonBody<T = Record<string, any>>(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): Promise<T> {
  // Pre-check Content-Length header
  const preCheck = checkBodySize(request, maxBytes);
  if (!preCheck.ok) {
    throw new BodyTooLargeError(preCheck.size, maxBytes);
  }

  // Read body as text and check actual size
  const text = await request.text();
  const actualSize = new TextEncoder().encode(text).length;
  if (actualSize > maxBytes) {
    throw new BodyTooLargeError(actualSize, maxBytes);
  }

  // Parse JSON
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

/**
 * Error thrown when request body exceeds the size limit.
 */
export class BodyTooLargeError extends Error {
  public readonly actualSize: number;
  public readonly maxSize: number;

  constructor(actualSize: number, maxSize: number) {
    super(`Request body too large: ${actualSize} bytes (max: ${maxSize})`);
    this.name = "BodyTooLargeError";
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }
}

/**
 * Error thrown when request body is not valid JSON.
 */
export class InvalidJsonError extends Error {
  constructor() {
    super("Invalid JSON in request body");
    this.name = "InvalidJsonError";
  }
}
