// GET /api/notifications/unread-count — used by AppBadgeSync to set the OS
// app-icon badge. Returns { count: number } for the current user's unread
// notifications. Lightweight: indexed query on (user_id, is_read).
import { NextResponse } from "next/server";
import { db, notifications } from "@/lib/db";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { and, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return NextResponse.json({ count: rows[0]?.count ?? 0 });
}
