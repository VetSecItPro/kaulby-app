import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, bookmarks, bookmarkCollections, results } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/bookmarks
 * Returns all bookmarks for the authenticated user, optionally filtered by collection.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collectionId = request.nextUrl.searchParams.get("collectionId");

  const where = collectionId
    ? and(eq(bookmarks.userId, userId), eq(bookmarks.collectionId, collectionId))
    : eq(bookmarks.userId, userId);

  const userBookmarks = await db.query.bookmarks.findMany({
    where,
    with: {
      result: {
        with: {
          monitor: {
            columns: { name: true },
          },
        },
      },
      collection: true,
    },
    orderBy: [desc(bookmarks.createdAt)],
  });

  return NextResponse.json({ bookmarks: userBookmarks });
}

/**
 * POST /api/bookmarks
 * Bookmark a result. Body: { resultId: string, collectionId?: string, note?: string }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { resultId, collectionId, note } = body as {
    resultId: string;
    collectionId?: string;
    note?: string;
  };

  if (!resultId) {
    return NextResponse.json({ error: "resultId is required" }, { status: 400 });
  }

  // Verify result exists and belongs to user's monitors
  const result = await db.query.results.findFirst({
    where: eq(results.id, resultId),
    with: { monitor: { columns: { userId: true } } },
  });

  if (!result || result.monitor.userId !== userId) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  // Verify collection belongs to user if provided
  if (collectionId) {
    const collection = await db.query.bookmarkCollections.findFirst({
      where: and(
        eq(bookmarkCollections.id, collectionId),
        eq(bookmarkCollections.userId, userId)
      ),
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
  }

  // Check for duplicate
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.resultId, resultId)),
  });

  if (existing) {
    // Update existing bookmark (move to different collection or update note)
    await db
      .update(bookmarks)
      .set({
        collectionId: collectionId || existing.collectionId,
        note: note !== undefined ? note : existing.note,
      })
      .where(eq(bookmarks.id, existing.id));
    return NextResponse.json({ bookmark: { ...existing, collectionId, note } });
  }

  const [bookmark] = await db
    .insert(bookmarks)
    .values({
      userId,
      resultId,
      collectionId: collectionId || null,
      note: note || null,
    })
    .returning();

  return NextResponse.json({ bookmark }, { status: 201 });
}
