// POST /api/push/subscribe — register a Web Push subscription for the user.
//
// Body shape matches PushSubscription.toJSON():
//   { endpoint, keys: { p256dh, auth } }
// Idempotent on endpoint (UNIQUE constraint) — re-subscribing replaces the
// row's keys + last_used_at without creating duplicates.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, pushSubscriptions } from "@/lib/db";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export async function POST(request: NextRequest) {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId, "write");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription", details: parsed.error.flatten() }, { status: 400 });

  const ua = request.headers.get("user-agent")?.slice(0, 512) ?? null;

  // Upsert: same endpoint = update keys + lastUsedAt; new endpoint = insert.
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: ua,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: ua,
        lastUsedAt: sql`NOW()`,
      },
    });

  return NextResponse.json({ ok: true });
}
