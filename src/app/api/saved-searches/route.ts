import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { savedSearches, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

// Maximum saved searches per plan
const SAVED_SEARCH_LIMITS = {
  free: 3,
  pro: 20,
  enterprise: 100,
};

// GET - List user's saved searches
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // FIX-219: Add limit to prevent unbounded query
    const searches = await db.query.savedSearches.findMany({
      where: eq(savedSearches.userId, userId),
      orderBy: [desc(savedSearches.lastUsedAt), desc(savedSearches.createdAt)],
      limit: 100, // Limit to 100 saved searches max
    });

    return NextResponse.json({ searches });
  } catch (error) {
    console.error("Failed to fetch saved searches:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved searches" },
      { status: 500 }
    );
  }
}

// POST - Create a new saved search
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, query, filters } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Check plan limits
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true },
    });

    const planKey = (user?.subscriptionStatus || "free") as keyof typeof SAVED_SEARCH_LIMITS;
    const limit = SAVED_SEARCH_LIMITS[planKey] || SAVED_SEARCH_LIMITS.free;

    // Count existing searches
    const existingSearches = await db.query.savedSearches.findMany({
      where: eq(savedSearches.userId, userId),
      columns: { id: true },
    });

    if (existingSearches.length >= limit) {
      return NextResponse.json(
        { error: `You've reached the limit of ${limit} saved searches for your plan` },
        { status: 403 }
      );
    }

    // Check for duplicate names
    const existingWithName = await db.query.savedSearches.findFirst({
      where: and(
        eq(savedSearches.userId, userId),
        eq(savedSearches.name, name.trim())
      ),
    });

    if (existingWithName) {
      return NextResponse.json(
        { error: "A saved search with this name already exists" },
        { status: 400 }
      );
    }

    // Create the saved search
    const [newSearch] = await db
      .insert(savedSearches)
      .values({
        userId,
        name: name.trim(),
        query: query.trim(),
        filters: filters || null,
      })
      .returning();

    return NextResponse.json({ search: newSearch }, { status: 201 });
  } catch (error) {
    console.error("Failed to create saved search:", error);
    return NextResponse.json(
      { error: "Failed to create saved search" },
      { status: 500 }
    );
  }
}
