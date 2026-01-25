import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { digestPaused, reportSchedule, reportDay } = body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (typeof digestPaused === "boolean") {
      updates.digestPaused = digestPaused;
    }

    if (reportSchedule !== undefined) {
      // Validate reportSchedule
      if (!["off", "weekly", "monthly"].includes(reportSchedule)) {
        return NextResponse.json(
          { error: "Invalid report schedule. Must be 'off', 'weekly', or 'monthly'" },
          { status: 400 }
        );
      }
      updates.reportSchedule = reportSchedule;
    }

    if (reportDay !== undefined) {
      // Validate reportDay based on schedule type
      const schedule = reportSchedule || "weekly";
      if (schedule === "weekly" && (reportDay < 1 || reportDay > 7)) {
        return NextResponse.json(
          { error: "Invalid day of week. Must be 1-7 (Monday-Sunday)" },
          { status: 400 }
        );
      }
      if (schedule === "monthly" && (reportDay < 1 || reportDay > 31)) {
        return NextResponse.json(
          { error: "Invalid day of month. Must be 1-31" },
          { status: 400 }
        );
      }
      updates.reportDay = reportDay;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update user
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update email preferences:", error);
    return NextResponse.json(
      { error: "Failed to update email preferences" },
      { status: 500 }
    );
  }
}
