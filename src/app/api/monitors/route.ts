import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { monitors, users } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

// Plan limits
const planLimits = {
  free: { monitors: 3 },
  pro: { monitors: 20 },
  enterprise: { monitors: Infinity },
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, keywords, platforms } = body;

    // Validate input
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "At least one keyword is required" }, { status: 400 });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json({ error: "At least one platform is required" }, { status: 400 });
    }

    // Validate platforms
    const validPlatforms = ["reddit", "hackernews", "producthunt"];
    const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p));
    if (invalidPlatforms.length > 0) {
      return NextResponse.json({ error: `Invalid platforms: ${invalidPlatforms.join(", ")}` }, { status: 400 });
    }

    // Get user subscription status
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    const subscriptionStatus = user?.subscriptionStatus || "free";
    const limit = planLimits[subscriptionStatus as keyof typeof planLimits];

    // Check monitor limit
    const existingMonitors = await db
      .select({ count: count() })
      .from(monitors)
      .where(eq(monitors.userId, userId));

    const currentCount = existingMonitors[0]?.count || 0;

    if (currentCount >= limit.monitors) {
      return NextResponse.json(
        { error: `You've reached your monitor limit (${limit.monitors}). Upgrade to add more.` },
        { status: 403 }
      );
    }

    // Create monitor
    const [newMonitor] = await db
      .insert(monitors)
      .values({
        userId,
        name: name.trim(),
        keywords: keywords.map((k: string) => k.trim()),
        platforms: platforms,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ monitor: newMonitor }, { status: 201 });
  } catch (error) {
    console.error("Error creating monitor:", error);
    return NextResponse.json({ error: "Failed to create monitor" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userMonitors = await db.query.monitors.findMany({
      where: eq(monitors.userId, userId),
      orderBy: (monitors, { desc }) => [desc(monitors.createdAt)],
    });

    return NextResponse.json({ monitors: userMonitors });
  } catch (error) {
    console.error("Error fetching monitors:", error);
    return NextResponse.json({ error: "Failed to fetch monitors" }, { status: 500 });
  }
}
