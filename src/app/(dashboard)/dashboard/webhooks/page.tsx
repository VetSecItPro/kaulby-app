import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, webhooks, webhookDeliveries } from "@/lib/db/schema";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { WebhookManagement } from "@/components/dashboard/webhook-management";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export default async function WebhooksPage() {
  const userId = await getEffectiveUserId();

  if (!userId) {
    if (!isLocalDev()) {
      redirect("/sign-in");
    }
    // In dev mode with no user, show enterprise view with empty webhooks
    return (
      <WebhookManagement
        isEnterprise={true}
        webhooks={[]}
        recentDeliveries={[]}
      />
    );
  }

  // Check if user is enterprise
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true },
  });

  const isEnterprise = user?.subscriptionStatus === "enterprise";

  // Get webhooks if enterprise
  let userWebhooks: typeof webhooks.$inferSelect[] = [];
  const recentDeliveries: (typeof webhookDeliveries.$inferSelect)[] = [];

  if (isEnterprise) {
    userWebhooks = await db.query.webhooks.findMany({
      where: eq(webhooks.userId, userId),
      orderBy: desc(webhooks.createdAt),
    });

    // Get recent deliveries for all user's webhooks in a single query
    if (userWebhooks.length > 0) {
      const webhookIds = userWebhooks.map(w => w.id);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const deliveries = await db.query.webhookDeliveries.findMany({
        where: and(
          inArray(webhookDeliveries.webhookId, webhookIds),
          gte(webhookDeliveries.createdAt, oneDayAgo)
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
