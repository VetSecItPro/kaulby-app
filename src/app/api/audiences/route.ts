import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db, audiences } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createAudienceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

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
