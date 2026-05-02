// POST /api/results/[id]/mark-read — set isViewed=true on a result.
// Idempotent (no toggle, no body required). Safe to replay via Background Sync.
import { NextResponse } from "next/server";
import { db, results } from "@/lib/db";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { eq } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId, "write");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

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
    .set({ isViewed: true, viewedAt: new Date() })
    .where(eq(results.id, id));

  return NextResponse.json({ success: true });
}
