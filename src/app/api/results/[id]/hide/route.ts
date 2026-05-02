// POST /api/results/[id]/hide — set isHidden on a result. Idempotent (takes
// the desired boolean from the client, never flips). Safe to replay via the
// Background Sync queue.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, results } from "@/lib/db";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { eq } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ hidden: z.boolean() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId, "write");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id } = await params;

  const result = await db.query.results.findFirst({
    where: eq(results.id, id),
    with: { monitor: { columns: { userId: true } } },
  });
  if (!result || result.monitor?.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(results)
    .set({ isHidden: parsed.data.hidden })
    .where(eq(results.id, id));

  return NextResponse.json({ success: true, isHidden: parsed.data.hidden });
}
