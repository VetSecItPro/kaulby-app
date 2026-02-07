import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - Update a saved search (name, or increment use count)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await parseJsonBody(request);
    const { name, incrementUse } = body;

    // Verify ownership
    const existingSearch = await db.query.savedSearches.findFirst({
      where: and(
        eq(savedSearches.id, id),
        eq(savedSearches.userId, userId)
      ),
    });

    if (!existingSearch) {
      return NextResponse.json(
        { error: "Saved search not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (incrementUse) {
      // Use SQL to increment and update timestamp atomically
      const [updated] = await db
        .update(savedSearches)
        .set({
          useCount: sql`${savedSearches.useCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
        .returning();

      return NextResponse.json({ search: updated });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(savedSearches)
      .set(updates)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning();

    return NextResponse.json({ search: updated });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error("Failed to update saved search:", error);
    return NextResponse.json(
      { error: "Failed to update saved search" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a saved search
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Verify ownership and delete
    const deleted = await db
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Saved search not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete saved search:", error);
    return NextResponse.json(
      { error: "Failed to delete saved search" },
      { status: 500 }
    );
  }
}
