// Web Push helper — server-side delivery using web-push + VAPID.
//
// Subscriptions live in the push_subscriptions table. Failed deliveries with
// HTTP 404/410 indicate the subscription was revoked (uninstall, browser data
// clear, etc.) — this module deletes those rows automatically.
import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "Push not configured: VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY required",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  configureVapid();
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  let pruned = 0;

  // Send in parallel; revoke dead endpoints individually so one bad sub
  // doesn't block delivery to the user's other devices.
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        sent++;
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404 = endpoint not found (browser uninstalled), 410 = gone (user revoked).
        // Both mean the subscription is permanently dead — prune it.
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          pruned++;
        } else {
          // Transient errors (network, push service rate-limit) — log, don't prune.
          console.error("[push] send failed", { userId, endpoint: sub.endpoint.slice(0, 60), status, err });
        }
      }
    }),
  );

  return { sent, pruned };
}
