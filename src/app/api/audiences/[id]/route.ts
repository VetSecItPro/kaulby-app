import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db, audiences } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateAudienceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/audiences/[id]
 * Update an audience
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateAudienceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.query.audiences.findFirst({
      where: and(eq(audiences.id, id), eq(audiences.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(audiences)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(audiences.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update audience:", error);
    return NextResponse.json(
      { error: "Failed to update audience" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/audiences/[id]
 * Delete an audience (monitors are preserved)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await db.query.audiences.findFirst({
      where: and(eq(audiences.id, id), eq(audiences.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 });
    }

    // Delete audience (cascade will remove audience_monitors entries)
    await db.delete(audiences).where(eq(audiences.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete audience:", error);
    return NextResponse.json(
      { error: "Failed to delete audience" },
      { status: 500 }
    );
  }
}
