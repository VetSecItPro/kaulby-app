// POST /api/notifications/mark-read-from-push
//
// Called by the SW when the user taps the "Mark read" action button on a
// push notification. Marks any unread notifications matching the URL/tag
// of the dismissed push so they don't keep flagging the dashboard.
//
// Best-effort: failures are silent (the SW already closed the notification,
// no UI to surface an error).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, notifications } from "@/lib/db";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { and, eq, like } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().min(1).max(512).optional(),
  tag: z.string().min(1).max(128).optional(),
});

export async function POST(request: NextRequest) {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true, marked: 0 });

  // Tag format from sw.ts is `monitor-${id}` — extract id and clear that monitor's
  // unread notifications. Falls back to URL-prefix match if tag is absent.
  const { url, tag } = parsed.data;
  let where = and(eq(notifications.userId, userId), eq(notifications.isRead, false));
  if (tag?.startsWith("monitor-")) {
    const monitorId = tag.slice("monitor-".length);
    where = and(where, eq(notifications.monitorId, monitorId));
  } else if (url) {
    where = and(where, like(notifications.title, `%${url.slice(0, 64)}%`));
  }

  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(where);

  return NextResponse.json({ ok: true, marked: result.rowCount ?? 0 });
}
