// POST /api/push/unsubscribe — remove a push subscription by endpoint.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, pushSubscriptions } from "@/lib/db";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const schema = z.object({ endpoint: z.string().url().max(2048) });

export async function POST(request: NextRequest) {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });

  // Scoped delete — only this user's row, even if a stranger somehow knew the endpoint.
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, parsed.data.endpoint)));

  return NextResponse.json({ ok: true });
}
