import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, webhooks, webhookDeliveries } from "@/lib/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { WebhookManagement } from "@/components/dashboard/webhook-management";

export default async function WebhooksPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
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

    // Get recent deliveries for all user's webhooks
    if (userWebhooks.length > 0) {
      const webhookIds = userWebhooks.map(w => w.id);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      for (const webhookId of webhookIds) {
        const deliveries = await db.query.webhookDeliveries.findMany({
          where: and(
            eq(webhookDeliveries.webhookId, webhookId),
            gte(webhookDeliveries.createdAt, oneDayAgo)
          ),
          orderBy: desc(webhookDeliveries.createdAt),
          limit: 10,
        });
        recentDeliveries.push(...deliveries);
      }
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
