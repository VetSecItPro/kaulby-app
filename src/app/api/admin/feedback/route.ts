import { getEffectiveUserId } from "@/lib/dev-auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedback, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";

// PATCH - Update feedback status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await parseJsonBody(request);
    const { id, status, adminNotes } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing feedback id" }, { status: 400 });
    }

    const validStatuses = ["open", "in_progress", "resolved", "closed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (typeof adminNotes === "string") updateData.adminNotes = adminNotes;

    await db
      .update(feedback)
      .set(updateData)
      .where(eq(feedback.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    console.error("Failed to update feedback:", error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
