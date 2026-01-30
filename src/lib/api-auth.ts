import { db } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Rate limits for API access
const DAILY_RATE_LIMIT = 10000; // 10,000 requests per day for Team tier

/**
 * Generate a new API key
 * Format: kaulby_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars)
 */
function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomPart = randomBytes(24).toString("base64url"); // 32 chars
  const key = `kaulby_live_${randomPart}`;
  const prefix = key.substring(0, 16); // "kaulby_live_xxxx"
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Hash an API key using SHA-256
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate an API key and return the user if valid
 */
async function validateApiKey(key: string): Promise<{
  valid: boolean;
  userId?: string;
  keyId?: string;
  error?: string;
}> {
  if (!key || !key.startsWith("kaulby_live_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  const keyHash = hashApiKey(key);

  // Find the API key in database
  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, keyHash),
      eq(apiKeys.isActive, true)
    ),
  });

  if (!apiKey) {
    return { valid: false, error: "Invalid or revoked API key" };
  }

  // Check if key has expired
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Check user's subscription (must be Team/Enterprise)
  const user = await db.query.users.findFirst({
    where: eq(users.id, apiKey.userId),
    columns: {
      id: true,
      subscriptionStatus: true,
      isBanned: true,
    },
  });

  if (!user) {
    return { valid: false, error: "User not found" };
  }

  if (user.isBanned) {
    return { valid: false, error: "Account is suspended" };
  }

  if (user.subscriptionStatus !== "enterprise") {
    return { valid: false, error: "API access requires Team plan" };
  }

  // Check rate limits
  const now = new Date();
  const resetAt = apiKey.dailyRequestResetAt ? new Date(apiKey.dailyRequestResetAt) : null;

  // Reset daily count if it's a new day
  if (!resetAt || now > resetAt) {
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    await db
      .update(apiKeys)
      .set({
        dailyRequestCount: 1,
        dailyRequestResetAt: tomorrow,
        requestCount: apiKey.requestCount + 1,
        lastUsedAt: now,
      })
      .where(eq(apiKeys.id, apiKey.id));
  } else {
    // Check if rate limit exceeded
    if (apiKey.dailyRequestCount >= DAILY_RATE_LIMIT) {
      return {
        valid: false,
        error: `Rate limit exceeded. Limit resets at ${resetAt.toISOString()}`,
      };
    }

    // Increment counters
    await db
      .update(apiKeys)
      .set({
        dailyRequestCount: apiKey.dailyRequestCount + 1,
        requestCount: apiKey.requestCount + 1,
        lastUsedAt: now,
      })
      .where(eq(apiKeys.id, apiKey.id));
  }

  return {
    valid: true,
    userId: apiKey.userId,
    keyId: apiKey.id,
  };
}

/**
 * Extract API key from request headers
 * Supports: Authorization: Bearer <key> or X-API-Key: <key>
 */
function extractApiKey(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Middleware to authenticate API requests
 * Returns userId if valid, or sends error response
 */
export async function withApiAuth(
  request: NextRequest,
  handler: (userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Missing API key",
        message: "Provide API key via Authorization: Bearer <key> or X-API-Key header",
      },
      { status: 401 }
    );
  }

  const validation = await validateApiKey(apiKey);

  if (!validation.valid) {
    const status = validation.error?.includes("Rate limit") ? 429 : 401;
    return NextResponse.json(
      { error: validation.error },
      { status }
    );
  }

  return handler(validation.userId!);
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  name: string,
  expiresAt?: Date
): Promise<{ id: string; key: string; prefix: string } | null> {
  // Check user has Team plan
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true },
  });

  if (user?.subscriptionStatus !== "enterprise") {
    return null;
  }

  // Check existing key count (limit to 5 active keys)
  const existingKeys = await db.query.apiKeys.findMany({
    where: and(
      eq(apiKeys.userId, userId),
      eq(apiKeys.isActive, true)
    ),
  });

  if (existingKeys.length >= 5) {
    return null;
  }

  const { key, prefix, hash } = generateApiKey();

  const [newKey] = await db
    .insert(apiKeys)
    .values({
      userId,
      name,
      keyPrefix: prefix,
      keyHash: hash,
      expiresAt,
    })
    .returning({ id: apiKeys.id });

  return {
    id: newKey.id,
    key, // Return full key only on creation - never stored
    prefix,
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  await db
    .update(apiKeys)
    .set({
      isActive: false,
      revokedAt: new Date(),
    })
    .where(and(
      eq(apiKeys.id, keyId),
      eq(apiKeys.userId, userId)
    ));

  return true;
}

/**
 * List API keys for a user (without the actual key values)
 */
export async function listApiKeys(userId: string) {
  return db.query.apiKeys.findMany({
    where: eq(apiKeys.userId, userId),
    columns: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      requestCount: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: (keys, { desc }) => [desc(keys.createdAt)],
  });
}
