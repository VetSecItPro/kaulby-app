import type { PlanKey } from "@/lib/plans";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq, count } from "drizzle-orm";
import { db, monitors, users } from "@/lib/db";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";
import { OnboardingChat } from "@/components/dashboard/onboarding-chat";

export const metadata: Metadata = { title: "Set Up with AI | Kaulby" };

export default async function OnboardingChatPage() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Check if user already has monitors — if so, redirect to dashboard
  if (userId) {
    const [monitorCount] = await db
      .select({ count: count() })
      .from(monitors)
      .where(eq(monitors.userId, userId));

    if (monitorCount.count > 0) {
      redirect("/dashboard");
    }
  }

  // Get user info for personalization
  const user = userId
    ? await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { subscriptionStatus: true, name: true },
      })
    : null;

  const userPlan = (user?.subscriptionStatus || (isLocalDev() ? "growth" : "free")) as PlanKey;
  const userName = user?.name || undefined;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <OnboardingChat userPlan={userPlan} userName={userName} />
    </div>
  );
}
