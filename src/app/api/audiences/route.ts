import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db, audiences, audienceMonitors } from "@/lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createAudienceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

/**
 * GET /api/audiences
 * List all audiences for the current user
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get audiences with their monitors through the junction table
    const userAudiences = await db.query.audiences.findMany({
      where: eq(audiences.userId, userId),
      orderBy: (audiences, { desc }) => [desc(audiences.createdAt)],
    });

    // For each audience, get its monitors
    const result = await Promise.all(
      userAudiences.map(async (audience) => {
        const audienceMonitorLinks = await db.query.audienceMonitors.findMany({
          where: eq(audienceMonitors.audienceId, audience.id),
          with: {
            monitor: {
              columns: {
                id: true,
                name: true,
                platforms: true,
              },
            },
          },
        });

        return {
          id: audience.id,
          name: audience.name,
          description: audience.description,
          color: audience.color,
          icon: audience.icon,
          createdAt: audience.createdAt,
          updatedAt: audience.updatedAt,
          monitorCount: audienceMonitorLinks.length,
          monitors: audienceMonitorLinks.map((am) => am.monitor),
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch audiences:", error);
    return NextResponse.json(
      { error: "Failed to fetch audiences" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audiences
 * Create a new audience
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createAudienceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, color, icon } = parsed.data;

    const [newAudience] = await db
      .insert(audiences)
      .values({
        userId,
        name,
        description,
        color,
        icon,
      })
      .returning();

    return NextResponse.json(newAudience, { status: 201 });
  } catch (error) {
    console.error("Failed to create audience:", error);
    return NextResponse.json(
      { error: "Failed to create audience" },
      { status: 500 }
    );
  }
}
