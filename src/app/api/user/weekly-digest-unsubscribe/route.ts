/**
 * One-click unsubscribe from the Monday weekly digest (Task 2.4).
 *
 * This is a GET endpoint so the link works directly from the email client
 * without requiring re-authentication — matching the List-Unsubscribe UX
 * required by major inbox providers.
 *
 * Security: the link is signed with HMAC (signTrackingParams) using the
 * user id as the payload, so only app-generated URLs flip the flag.
 * We reuse the existing tracking HMAC so there's no new secret to manage.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyTrackingSignature } from "@/lib/security/hmac";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const uid = url.searchParams.get("uid");
  const sig = url.searchParams.get("sig");

  if (!uid || !sig) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Reuse the tracking-HMAC helper — bind the signature to this specific
  // user id + a stable "type" so it can't be replayed against other endpoints.
  const valid = verifyTrackingSignature(
    { eid: uid, uid, type: "weekly-digest-unsub", url: "" },
    sig
  );

  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    await db
      .update(users)
      .set({ weeklyDigestEnabled: false })
      .where(eq(users.id, uid));
  } catch (error) {
    logger.error("Weekly digest unsubscribe failed", {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }

  // Render a tiny confirmation page — no app shell, no auth needed.
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;background:#0a0a0a;color:#fafafa;text-align:center;padding:80px 24px;">
      <h1 style="font-size:24px;margin:0 0 12px;">Unsubscribed</h1>
      <p style="color:#a1a1aa;max-width:440px;margin:0 auto;">You won't receive Monday weekly digests anymore. You can re-enable them in your <a href="https://kaulbyapp.com/dashboard/settings" style="color:#5eead4;">email preferences</a>.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
