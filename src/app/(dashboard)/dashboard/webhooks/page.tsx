import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, webhooks, webhookDeliveries } from "@/lib/db/schema";
import { eq, desc, and, gte, inArray, isNull } from "drizzle-orm";
import { WebhookManagement } from "@/components/dashboard/webhook-management";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export const metadata: Metadata = { title: "Webhooks | Kaulby" };

async function WebhooksContent() {
  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    // In dev mode with no user, show team view with empty webhooks
    return (
      <WebhookManagement
        isEnterprise={true}
        webhooks={[]}
        recentDeliveries={[]}
      />
    );
  }

  // Check if user is team tier
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true },
  });

  const isEnterprise = user?.subscriptionStatus === "team";

  // Get webhooks if team tier
  let userWebhooks: typeof webhooks.$inferSelect[] = [];
  const recentDeliveries: (typeof webhookDeliveries.$inferSelect)[] = [];

  if (isEnterprise) {
    userWebhooks = await db.query.webhooks.findMany({
      where: eq(webhooks.userId, userId),
      orderBy: desc(webhooks.createdAt),
      limit: 100,
    });

    // Get recent deliveries for all user's webhooks in a single query
    if (userWebhooks.length > 0) {
      const webhookIds = userWebhooks.map(w => w.id);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const deliveries = await db.query.webhookDeliveries.findMany({
        where: and(
          inArray(webhookDeliveries.webhookId, webhookIds),
          gte(webhookDeliveries.createdAt, oneDayAgo),
          // Task DL.3: hide rows already soft-deleted by retention.
          isNull(webhookDeliveries.deletedAt)
        ),
        orderBy: desc(webhookDeliveries.createdAt),
        limit: 50,
      });
      recentDeliveries.push(...deliveries);
    }
  }

  return (
    <WebhookManagement
      isEnterprise={isEnterprise}
      webhooks={userWebhooks}
      recentDeliveries={recentDeliveries}
    />
  );
}

export default function WebhooksPage() {
  return (
    <Suspense fallback={<div className="animate-pulse p-6">Loading...</div>}>
      <WebhooksContent />
    </Suspense>
  );
}
