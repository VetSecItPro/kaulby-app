import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import { CompetitorComparison } from "@/components/dashboard/competitor-comparison";
import { Lock } from "lucide-react";

export const metadata: Metadata = { title: "Competitors | Kaulby" };

function CompetitorsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse h-8 w-64 bg-muted rounded" />
      <div className="animate-pulse h-4 w-96 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="animate-pulse h-80 bg-muted rounded-lg" />
    </div>
  );
}

function UpgradePrompt() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Competitor Comparison</h1>
        <p className="text-muted-foreground">
          Compare your brand against competitors across platforms.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 border border-dashed border-muted-foreground/25 rounded-lg">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Pro Feature</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Competitor comparison is available on Pro and Team plans. Upgrade to track how your brand
          stacks up against competitors across sentiment, mentions, and engagement.
        </p>
        <a
          href="/dashboard/settings"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Upgrade Plan
        </a>
      </div>
    </div>
  );
}

async function CompetitorsContent() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Get user's subscription status for feature gating
  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { subscriptionStatus: true },
      })
    : null;

  // In dev mode without a user, default to team for full feature testing
  const subscriptionStatus = user?.subscriptionStatus || (isLocalDev() ? "growth" : "free");

  // Gate to Pro+ users
  if (subscriptionStatus === "free") {
    return <UpgradePrompt />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Competitor Comparison</h1>
        <p className="text-muted-foreground">
          Compare your brand against competitors across mentions, sentiment, and engagement.
        </p>
      </div>

      <CompetitorComparison />
    </div>
  );
}

export default async function CompetitorsPage() {
  return (
    <Suspense fallback={<CompetitorsSkeleton />}>
      <CompetitorsContent />
    </Suspense>
  );
}
