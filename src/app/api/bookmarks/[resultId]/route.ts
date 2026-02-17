import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, bookmarks } from "@/lib/db";
import { eq, and } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ resultId: string }>;
}

/**
 * DELETE /api/bookmarks/[resultId]
 * Remove a bookmark by result ID.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resultId } = await params;

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.resultId, resultId)),
  });

  if (!existing) {
    return NextResponse.json({ error: "Bookmark not found" }, { status: 404 });
  }

  await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));

  return NextResponse.json({ success: true });
}
