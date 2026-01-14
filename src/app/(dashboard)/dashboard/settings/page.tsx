import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, aiLogs, usage, monitors, results } from "@/lib/db/schema";
import { eq, and, gte, sum, count } from "drizzle-orm";
import { ResponsiveSettings } from "@/components/dashboard/responsive-settings";

async function getAiUsageStats(userId: string) {
  // Get current billing period
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  const periodStart = user?.currentPeriodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Get AI usage for current period
  const aiUsage = await db
    .select({
      totalPromptTokens: sum(aiLogs.promptTokens),
      totalCompletionTokens: sum(aiLogs.completionTokens),
      totalCost: sum(aiLogs.costUsd),
      callCount: count(),
    })
    .from(aiLogs)
    .where(
      and(
        eq(aiLogs.userId, userId),
        gte(aiLogs.createdAt, periodStart)
      )
    );

  return {
    promptTokens: Number(aiUsage[0]?.totalPromptTokens) || 0,
    completionTokens: Number(aiUsage[0]?.totalCompletionTokens) || 0,
    totalTokens: (Number(aiUsage[0]?.totalPromptTokens) || 0) + (Number(aiUsage[0]?.totalCompletionTokens) || 0),
    totalCost: Number(aiUsage[0]?.totalCost) || 0,
    callCount: Number(aiUsage[0]?.callCount) || 0,
    periodStart,
  };
}

async function getDataStats(userId: string) {
  // Get monitor count
  const [monitorCount] = await db
    .select({ count: count() })
    .from(monitors)
    .where(eq(monitors.userId, userId));

  // Get results count
  const userMonitors = await db.query.monitors.findMany({
    where: eq(monitors.userId, userId),
    columns: { id: true },
  });

  const monitorIds = userMonitors.map(m => m.id);
  let resultsCount = 0;

  if (monitorIds.length > 0) {
    // Sum all results across monitors
    for (const monitorId of monitorIds) {
      const [rc] = await db
        .select({ count: count() })
        .from(results)
        .where(eq(results.monitorId, monitorId));
      resultsCount += rc?.count || 0;
    }
  }

  // Get usage record
  const usageRecord = await db.query.usage.findFirst({
    where: eq(usage.userId, userId),
    orderBy: (usage, { desc }) => [desc(usage.createdAt)],
  });

  return {
    monitors: monitorCount?.count || 0,
    results: resultsCount,
    aiCalls: usageRecord?.aiCallsCount || 0,
  };
}

export default async function SettingsPage() {
  const isDev = process.env.NODE_ENV === "development";

  let userId: string | null = null;
  let clerkUser = null;

  if (!isDev) {
    const authResult = await auth();
    userId = authResult.userId;
    clerkUser = await currentUser();

    if (!userId) {
      redirect("/sign-in");
    }
  }

  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
    : null;

  const subscriptionStatus = user?.subscriptionStatus || "free";
  const email = clerkUser?.emailAddresses[0]?.emailAddress || user?.email || "demo@example.com";
  const name = clerkUser?.fullName || user?.name || "Demo User";
  const timezone = user?.timezone || "America/New_York";

  // Get AI usage and data stats
  const aiUsage = userId ? await getAiUsageStats(userId) : {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    callCount: 0,
    periodStart: new Date(),
  };

  const dataStats = userId ? await getDataStats(userId) : {
    monitors: 0,
    results: 0,
    aiCalls: 0,
  };

  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Get started with basic monitoring",
      features: ["3 monitors", "100 results/month", "Basic analytics"],
      current: subscriptionStatus === "free",
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For growing businesses",
      features: [
        "20 monitors",
        "5,000 results/month",
        "AI-powered insights",
        "Email & Slack alerts",
        "Priority support",
      ],
      current: subscriptionStatus === "pro",
      recommended: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large organizations",
      features: [
        "Unlimited monitors",
        "Unlimited results",
        "Advanced AI analysis",
        "Custom integrations",
        "Dedicated support",
        "SLA guarantee",
      ],
      current: subscriptionStatus === "enterprise",
    },
  ];

  return (
    <ResponsiveSettings
      email={email}
      name={name}
      subscriptionStatus={subscriptionStatus}
      timezone={timezone}
      plans={plans}
      aiUsage={aiUsage}
      dataStats={dataStats}
      userId={userId || ""}
    />
  );
}
