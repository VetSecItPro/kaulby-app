// POST /api/push/test — send a test push to the authenticated user's devices.
// Used by the settings UI ("Send test notification" button) to verify the
// subscription works before relying on it for real alerts.
import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { sendPushToUser } from "@/lib/push";
import { checkApiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getEffectiveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId, "write");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const result = await sendPushToUser(userId, {
      title: "Kaulby test notification",
      body: "Push notifications are working. You'll get alerts here when high-intent leads come in.",
      url: "/dashboard",
      tag: "kaulby-test",
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
