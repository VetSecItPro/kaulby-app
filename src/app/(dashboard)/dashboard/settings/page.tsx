// PERF: Dynamic import settings tabs — FIX-204
import { Suspense } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, usage, monitors, results } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { ResponsiveSettings } from "@/components/dashboard/responsive-settings";

async function getDataStats(userId: string) {
  // Run all queries in parallel for better performance
  const [monitorCountResult, resultsCountResult, usageRecord] = await Promise.all([
    // Get monitor count
    db.select({ count: count() })
      .from(monitors)
      .where(eq(monitors.userId, userId)),

    // Get total results count across all user's monitors in a single query
    // Uses a subquery to avoid N+1 problem
    db.select({ count: count() })
      .from(results)
      .innerJoin(monitors, eq(results.monitorId, monitors.id))
      .where(eq(monitors.userId, userId)),

    // Get usage record
    db.query.usage.findFirst({
      where: eq(usage.userId, userId),
      orderBy: (usage, { desc }) => [desc(usage.createdAt)],
    }),
  ]);

  return {
    monitors: monitorCountResult[0]?.count || 0,
    results: resultsCountResult[0]?.count || 0,
    aiCalls: usageRecord?.aiCallsCount || 0,
  };
}

function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse h-8 w-48 bg-muted rounded" />
      <div className="grid gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse h-48 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}

async function SettingsContent() {
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

  // First try to find user by Clerk ID
  let user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
    : null;

  // Fallback: if not found by ID, try by email (handles Clerk ID mismatch)
  const clerkEmail = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!user && clerkEmail) {
    user = await db.query.users.findFirst({
      where: eq(users.email, clerkEmail),
    });
  }

  // In dev mode, default to enterprise (Team) for full feature testing
  const subscriptionStatus = isDev ? "enterprise" : (user?.subscriptionStatus || "free");
  // In dev mode, show actual user email if available, otherwise show a clear dev mode indicator
  const email = clerkEmail || user?.email || (isDev ? "dev-mode@kaulby.local" : "");
  const name = clerkUser?.fullName || user?.name || (isDev ? "Dev Mode User" : "");
  const timezone = user?.timezone || "America/New_York";

  // Email & Report preferences
  const digestPaused = user?.digestPaused || false;
  const reportSchedule = user?.reportSchedule || "off";
  const reportDay = user?.reportDay || 1;

  // Get data stats
  const dataStats = userId ? await getDataStats(userId) : {
    monitors: 0,
    results: 0,
    aiCalls: 0,
  };

  // Plans synced with pricing page
  const plans = [
    {
      name: "Free",
      price: "$0",
      description: "Get started with basic monitoring",
      features: [
        "1 monitor",
        "Reddit only",
        "3 keywords per monitor",
        "View last 3 results",
        "3-day history",
        "Basic AI analysis",
      ],
      current: subscriptionStatus === "free",
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For power users and professionals",
      features: [
        "10 monitors",
        "9 platforms",
        "10 keywords per monitor",
        "Unlimited results",
        "90-day history",
        "4-hour refresh cycle",
        "Full AI analysis",
        "Email + Slack alerts",
        "Daily digests",
        "CSV export",
      ],
      current: subscriptionStatus === "pro",
      recommended: true,
    },
    {
      name: "Team",
      price: "$99",
      period: "/month",
      description: "For growing teams and agencies",
      features: [
        "Everything in Pro",
        "30 monitors",
        "All 17 platforms",
        "20 keywords per monitor",
        "1-year history",
        "2-hour refresh cycle",
        "Comprehensive AI analysis",
        "Webhooks + API access",
        "5 team seats (+$15/user)",
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
      dataStats={dataStats}
      userId={userId || ""}
      digestPaused={digestPaused}
      reportSchedule={reportSchedule}
      reportDay={reportDay}
    />
  );
}

export default async function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
