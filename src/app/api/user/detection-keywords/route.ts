import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, userDetectionKeywords } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getPlanLimits } from "@/lib/plans";
import { getUserPlan } from "@/lib/limits";
import { DETECTION_CATEGORIES, type DetectionCategory } from "@/lib/detection-defaults";
import { checkApiRateLimit } from "@/lib/rate-limit";

const VALID_CATEGORIES = DETECTION_CATEGORIES.map((c) => c.category);

/**
 * GET /api/user/detection-keywords
 * Returns all custom detection keywords for the authenticated user.
 * If none exist, returns the defaults (unseeded).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkApiRateLimit(userId, "read");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
  }

  // Check plan — Pro+ only
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  if (!limits.aiFeatures.unlimitedAiAnalysis) {
    return NextResponse.json(
      { error: "Custom detection keywords require a Pro or Team plan" },
      { status: 403 }
    );
  }

  const existing = await db.query.userDetectionKeywords.findMany({
    where: eq(userDetectionKeywords.userId, userId),
  });

  // If user has no custom keywords yet, return defaults (not persisted)
  if (existing.length === 0) {
    const defaults = DETECTION_CATEGORIES.map((c) => ({
      id: null,
      category: c.category,
      keywords: c.defaultKeywords,
      isActive: true,
      isDefault: true, // Indicates these aren't saved yet
    }));
    return NextResponse.json({ keywords: defaults });
  }

  // Merge with any missing categories (in case new categories are added)
  const existingCategories = new Set(existing.map((e) => e.category));
  const merged = [
    ...existing.map((e) => ({
      id: e.id,
      category: e.category,
      keywords: e.keywords,
      isActive: e.isActive,
      isDefault: false,
    })),
    ...DETECTION_CATEGORIES.filter((c) => !existingCategories.has(c.category)).map((c) => ({
      id: null,
      category: c.category,
      keywords: c.defaultKeywords,
      isActive: true,
      isDefault: true,
    })),
  ];

  return NextResponse.json({ keywords: merged });
}

/**
 * PUT /api/user/detection-keywords
 * Upsert keywords for a specific category.
 * Body: { category: string, keywords: string[], isActive?: boolean }
 */
export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkApiRateLimit(userId, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
  }

  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  if (!limits.aiFeatures.unlimitedAiAnalysis) {
    return NextResponse.json(
      { error: "Custom detection keywords require a Pro or Team plan" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { category, keywords, isActive } = body as {
    category: string;
    keywords: string[];
    isActive?: boolean;
  };

  if (!category || !VALID_CATEGORIES.includes(category as DetectionCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (!Array.isArray(keywords)) {
    return NextResponse.json({ error: "Keywords must be an array" }, { status: 400 });
  }

  // Sanitize: trim, lowercase, deduplicate, limit to 50 keywords per category
  const cleaned = Array.from(new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 50);

  // Check if row exists for this user+category
  const existing = await db.query.userDetectionKeywords.findFirst({
    where: and(
      eq(userDetectionKeywords.userId, userId),
      eq(userDetectionKeywords.category, category)
    ),
  });

  if (existing) {
    await db
      .update(userDetectionKeywords)
      .set({
        keywords: cleaned,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(userDetectionKeywords.id, existing.id));
  } else {
    await db.insert(userDetectionKeywords).values({
      userId,
      category,
      keywords: cleaned,
      isActive: isActive ?? true,
    });
  }

  return NextResponse.json({ success: true, category, keywords: cleaned });
}

/**
 * POST /api/user/detection-keywords
 * Seed all categories with defaults (first-time setup).
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkApiRateLimit(userId, "write");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
  }

  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  if (!limits.aiFeatures.unlimitedAiAnalysis) {
    return NextResponse.json(
      { error: "Custom detection keywords require a Pro or Team plan" },
      { status: 403 }
    );
  }

  // Check if already seeded
  const existing = await db.query.userDetectionKeywords.findMany({
    where: eq(userDetectionKeywords.userId, userId),
  });

  if (existing.length > 0) {
    return NextResponse.json({ message: "Already initialized", count: existing.length });
  }

  // Seed all categories with defaults
  const values = DETECTION_CATEGORIES.map((c) => ({
    userId,
    category: c.category,
    keywords: c.defaultKeywords,
    isActive: true,
  }));

  await db.insert(userDetectionKeywords).values(values);

  return NextResponse.json({ success: true, count: values.length });
}
