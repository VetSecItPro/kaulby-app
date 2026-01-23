import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-auth";
import { findUserWithFallback } from "@/lib/auth-utils";

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

    const body = await request.json();
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

    // Calculate expiration date if provided
    let expiresAt: Date | undefined;
    if (expiresInDays && typeof expiresInDays === "number") {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Use user.id for database operations (handles Clerk ID mismatch)
    const result = await createApiKey(user.id, name, expiresAt);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create API key. Either you've reached the limit (5 keys) or you need a Team plan." },
        { status: 403 }
      );
    }

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke API key error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
