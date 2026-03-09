import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, bookmarkCollections, bookmarks } from "@/lib/db";
import { eq, and, count, desc } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const deleteCollectionSchema = z.object({
  id: z.string().min(1).max(100),
});

/**
 * GET /api/bookmarks/collections
 * Returns all bookmark collections for the authenticated user with bookmark counts.
 */
export async function GET() {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkApiRateLimit(userId, "read");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
  }

  const collections = await db.query.bookmarkCollections.findMany({
    where: eq(bookmarkCollections.userId, userId),
    orderBy: [desc(bookmarkCollections.createdAt)],
  });

  // Get bookmark counts per collection
  const counts = await db
    .select({
      collectionId: bookmarks.collectionId,
      count: count(),
    })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .groupBy(bookmarks.collectionId);

  const countMap = new Map(counts.map((c) => [c.collectionId, c.count]));

  // Also count uncategorized bookmarks (no collection)
  const uncategorizedCount = countMap.get(null) || 0;

  const collectionsWithCounts = collections.map((c) => ({
    ...c,
    bookmarkCount: countMap.get(c.id) || 0,
  }));

  return NextResponse.json({
    collections: collectionsWithCounts,
    uncategorizedCount,
  });
}

/**
 * POST /api/bookmarks/collections
 * Create a new bookmark collection. Body: { name: string, color?: string }
 */
export async function POST(request: NextRequest) {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkApiRateLimit(userId, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { name, color } = parsed.data;

  // Limit collections per user (prevent abuse)
  const existingCount = await db
    .select({ count: count() })
    .from(bookmarkCollections)
    .where(eq(bookmarkCollections.userId, userId));

  if ((existingCount[0]?.count || 0) >= 20) {
    return NextResponse.json(
      { error: "Maximum 20 collections allowed" },
      { status: 400 }
    );
  }

  const [collection] = await db
    .insert(bookmarkCollections)
    .values({
      userId,
      name: name.trim(),
      color: color || null,
    })
    .returning();

  return NextResponse.json({ collection }, { status: 201 });
}

/**
 * DELETE /api/bookmarks/collections
 * Delete a collection. Body: { id: string }
 * Bookmarks in the collection are NOT deleted — they become uncategorized.
 */
export async function DELETE(request: NextRequest) {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkApiRateLimit(userId, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = deleteCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id } = parsed.data;

  const collection = await db.query.bookmarkCollections.findFirst({
    where: and(
      eq(bookmarkCollections.id, id),
      eq(bookmarkCollections.userId, userId)
    ),
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  // Move bookmarks to uncategorized before deleting collection
  await db
    .update(bookmarks)
    .set({ collectionId: null })
    .where(eq(bookmarks.collectionId, id));

  await db.delete(bookmarkCollections).where(eq(bookmarkCollections.id, id));

  return NextResponse.json({ success: true });
}
