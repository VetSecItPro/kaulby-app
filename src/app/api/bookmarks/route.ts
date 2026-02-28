import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, bookmarks, bookmarkCollections, results } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const createBookmarkSchema = z.object({
  resultId: z.string().min(1).max(100),
  collectionId: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
});

/**
 * GET /api/bookmarks
 * Returns all bookmarks for the authenticated user, optionally filtered by collection.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkApiRateLimit(userId, "read");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
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

  const response = NextResponse.json({ bookmarks: userBookmarks });
  response.headers.set("Cache-Control", "private, no-cache, must-revalidate");
  return response;
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

  const parsed = createBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { resultId, collectionId, note } = parsed.data;

  // Verify result exists and check for duplicate in parallel (independent queries)
  const [result, existing] = await Promise.all([
    db.query.results.findFirst({
      where: eq(results.id, resultId),
      with: { monitor: { columns: { userId: true } } },
    }),
    db.query.bookmarks.findFirst({
      where: and(eq(bookmarks.userId, userId), eq(bookmarks.resultId, resultId)),
    }),
  ]);

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
