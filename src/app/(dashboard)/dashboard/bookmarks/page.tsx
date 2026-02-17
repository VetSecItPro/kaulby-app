import { redirect } from "next/navigation";
import { db, results, bookmarkCollections, bookmarks } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import { BookmarksView } from "@/components/dashboard/bookmarks-view";

export default async function BookmarksPage() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Get all saved results (isSaved = true) for the user
  const savedResults = userId
    ? await db.query.results.findMany({
        where: and(eq(results.isSaved, true)),
        with: {
          monitor: {
            columns: { name: true, userId: true },
          },
        },
        orderBy: [desc(results.createdAt)],
        limit: 200,
      })
    : [];

  // Filter to only user's monitors
  const userSavedResults = savedResults.filter(
    (r) => r.monitor?.userId === userId
  );

  // Get user's bookmark collections with counts
  const collections = userId
    ? await db.query.bookmarkCollections.findMany({
        where: eq(bookmarkCollections.userId, userId),
        orderBy: [desc(bookmarkCollections.createdAt)],
      })
    : [];

  // Get bookmark-to-collection mappings
  const userBookmarks = userId
    ? await db.query.bookmarks.findMany({
        where: eq(bookmarks.userId, userId),
      })
    : [];

  const bookmarkMap = new Map(
    userBookmarks.map((b) => [b.resultId, { collectionId: b.collectionId, note: b.note }])
  );

  // Compute collection counts
  const collectionCounts = new Map<string | null, number>();
  for (const b of userBookmarks) {
    const key = b.collectionId;
    collectionCounts.set(key, (collectionCounts.get(key) || 0) + 1);
  }

  const collectionsWithCounts = collections.map((c) => ({
    ...c,
    bookmarkCount: collectionCounts.get(c.id) || 0,
  }));

  return (
    <BookmarksView
      results={userSavedResults}
      collections={collectionsWithCounts}
      bookmarkMap={Object.fromEntries(bookmarkMap)}
    />
  );
}
