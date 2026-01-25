import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetAlerts, budgetAlertHistory, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

// GET - List all budget alerts
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const alerts = await db.query.budgetAlerts.findMany({
      orderBy: [desc(budgetAlerts.createdAt)],
      with: {
        history: {
          orderBy: [desc(budgetAlertHistory.createdAt)],
          limit: 5,
        },
      },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error fetching budget alerts:", error);
    return NextResponse.json({ error: "Failed to fetch budget alerts" }, { status: 500 });
  }
}

// POST - Create a new budget alert
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, period, thresholdUsd, warningPercent, notifyEmail, notifySlack } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!period || !["daily", "weekly", "monthly"].includes(period)) {
      return NextResponse.json({ error: "Period must be daily, weekly, or monthly" }, { status: 400 });
    }

    if (typeof thresholdUsd !== "number" || thresholdUsd <= 0) {
      return NextResponse.json({ error: "Threshold must be a positive number" }, { status: 400 });
    }

    // Validate warning percent
    const validWarningPercent = typeof warningPercent === "number" && warningPercent > 0 && warningPercent < 100
      ? warningPercent
      : 80;

    // Validate email format if provided
    if (notifyEmail && typeof notifyEmail === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(notifyEmail)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
    }

    // Validate Slack webhook URL if provided
    if (notifySlack && typeof notifySlack === "string") {
      if (!notifySlack.startsWith("https://hooks.slack.com/")) {
        return NextResponse.json({ error: "Invalid Slack webhook URL" }, { status: 400 });
      }
    }

    const [newAlert] = await db
      .insert(budgetAlerts)
      .values({
        name: name.trim(),
        period,
        thresholdUsd,
        warningPercent: validWarningPercent,
        notifyEmail: notifyEmail?.trim() || null,
        notifySlack: notifySlack?.trim() || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ alert: newAlert }, { status: 201 });
  } catch (error) {
    console.error("Error creating budget alert:", error);
    return NextResponse.json({ error: "Failed to create budget alert" }, { status: 500 });
  }
}
