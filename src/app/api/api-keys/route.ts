import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-auth";
import { findUserWithFallback } from "@/lib/auth-utils";
import { logError } from "@/lib/error-logger";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/api-keys - List all API keys for the current user
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkApiRateLimit(userId, 'read');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Check if user has Team plan (with email fallback for Clerk ID mismatch)
    const user = await findUserWithFallback(userId);

    if (!user || user.subscriptionStatus !== "enterprise") {
      return NextResponse.json(
        { error: "API access requires Team plan" },
        { status: 403 }
      );
    }

    // Use user.id for database operations (handles Clerk ID mismatch)
    const keys = await listApiKeys(user.id);

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("List API keys error:", error);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/api-keys - Create a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    const body = await parseJsonBody(request);
    const { name, expiresInDays } = body;

    if (!name || typeof name !== "string" || name.length < 1) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Find user with email fallback for Clerk ID mismatch
    const user = await findUserWithFallback(userId);
    if (!user || user.subscriptionStatus !== "enterprise") {
      return NextResponse.json(
        { error: "API access requires Team plan" },
        { status: 403 }
      );
    }

    // Calculate expiration date (default: 365 days, max: 365 days)
    const MAX_EXPIRY_DAYS = 365;
    const DEFAULT_EXPIRY_DAYS = 365;
    const days = (expiresInDays && typeof expiresInDays === "number" && expiresInDays > 0)
      ? Math.min(expiresInDays, MAX_EXPIRY_DAYS)
      : DEFAULT_EXPIRY_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Use user.id for database operations (handles Clerk ID mismatch)
    const result = await createApiKey(user.id, name, expiresAt);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create API key. Either you've reached the limit (5 keys) or you need a Team plan." },
        { status: 403 }
      );
    }

    // Audit log: API key created
    logError({
      level: "warning",
      source: "api",
      message: `API key created: ${result.prefix}`,
      userId: user.id,
      endpoint: "POST /api/api-keys",
      context: { keyId: result.id, keyPrefix: result.prefix },
    });

    // Return the full key only once - user must save it
    // Include keyInfo for the UI to add to the list
    return NextResponse.json({
      message: "API key created successfully. Save this key - it won't be shown again.",
      key: result.key,
      keyInfo: {
        id: result.id,
        name: name.trim(),
        keyPrefix: result.prefix,
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
        requestCount: 0,
        isActive: true,
      },
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error("Create API key error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/api-keys - Revoke an API key
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    const { searchParams } = new URL(request.url);
    // Support both 'id' and 'keyId' for backwards compatibility
    const keyId = searchParams.get("keyId") || searchParams.get("id");

    if (!keyId) {
      return NextResponse.json(
        { error: "Key ID is required" },
        { status: 400 }
      );
    }

    // Find user with email fallback for Clerk ID mismatch
    const user = await findUserWithFallback(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Use user.id for database operations (handles Clerk ID mismatch)
    await revokeApiKey(keyId, user.id);

    // Audit log: API key revoked
    logError({
      level: "warning",
      source: "api",
      message: `API key revoked: ${keyId}`,
      userId: user.id,
      endpoint: "DELETE /api/api-keys",
      context: { keyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke API key error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
