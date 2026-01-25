import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetAlerts, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

// PATCH - Update a budget alert
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check alert exists
    const existing = await db.query.budgetAlerts.findFirst({
      where: eq(budgetAlerts.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Budget alert not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, period, thresholdUsd, warningPercent, notifyEmail, notifySlack, isActive } = body;

    // Build update object
    const updateData: Partial<typeof budgetAlerts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (period !== undefined) {
      if (!["daily", "weekly", "monthly"].includes(period)) {
        return NextResponse.json({ error: "Period must be daily, weekly, or monthly" }, { status: 400 });
      }
      updateData.period = period;
    }

    if (thresholdUsd !== undefined) {
      if (typeof thresholdUsd !== "number" || thresholdUsd <= 0) {
        return NextResponse.json({ error: "Threshold must be a positive number" }, { status: 400 });
      }
      updateData.thresholdUsd = thresholdUsd;
    }

    if (warningPercent !== undefined) {
      if (typeof warningPercent !== "number" || warningPercent <= 0 || warningPercent >= 100) {
        return NextResponse.json({ error: "Warning percent must be between 1 and 99" }, { status: 400 });
      }
      updateData.warningPercent = warningPercent;
    }

    if (notifyEmail !== undefined) {
      if (notifyEmail === null || notifyEmail === "") {
        updateData.notifyEmail = null;
      } else if (typeof notifyEmail === "string") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(notifyEmail)) {
          return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
        }
        updateData.notifyEmail = notifyEmail.trim();
      }
    }

    if (notifySlack !== undefined) {
      if (notifySlack === null || notifySlack === "") {
        updateData.notifySlack = null;
      } else if (typeof notifySlack === "string") {
        if (!notifySlack.startsWith("https://hooks.slack.com/")) {
          return NextResponse.json({ error: "Invalid Slack webhook URL" }, { status: 400 });
        }
        updateData.notifySlack = notifySlack.trim();
      }
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const [updatedAlert] = await db
      .update(budgetAlerts)
      .set(updateData)
      .where(eq(budgetAlerts.id, id))
      .returning();

    return NextResponse.json({ alert: updatedAlert });
  } catch (error) {
    console.error("Error updating budget alert:", error);
    return NextResponse.json({ error: "Failed to update budget alert" }, { status: 500 });
  }
}

// DELETE - Remove a budget alert
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check alert exists
    const existing = await db.query.budgetAlerts.findFirst({
      where: eq(budgetAlerts.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: "Budget alert not found" }, { status: 404 });
    }

    // Delete (cascade will delete history)
    await db.delete(budgetAlerts).where(eq(budgetAlerts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting budget alert:", error);
    return NextResponse.json({ error: "Failed to delete budget alert" }, { status: 500 });
  }
}
