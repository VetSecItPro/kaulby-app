import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardClientWrapper } from "@/components/dashboard/dashboard-client-wrapper";
import { ResponsiveDashboardLayout } from "@/components/dashboard/responsive-dashboard-layout";
import { RoutePreloader } from "@/components/dashboard/route-preloader";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import { db } from "@/lib/db";
import { monitors, users } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SECURITY: Only allow dev bypass on verified local development
  // This is defense-in-depth - middleware also protects this route
  const isLocalDev = process.env.NODE_ENV === "development" &&
                     !process.env.VERCEL &&
                     !process.env.VERCEL_ENV;

  // In verified local dev, provide easy testing setup
  if (isLocalDev) {
    return (
      <ResponsiveDashboardLayout isAdmin={true} subscriptionStatus="enterprise">
        <RoutePreloader />
        <ServiceWorkerRegister />
        <DashboardClientWrapper isNewUser={false} userName="Dev User">
          {children}
        </DashboardClientWrapper>
      </ResponsiveDashboardLayout>
    );
  }

  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Run Clerk user fetch and DB queries in parallel to reduce blocking time
  const userColumns = { isAdmin: true, subscriptionStatus: true, isBanned: true, onboardingCompleted: true, dayPassExpiresAt: true, workspaceRole: true } as const;
  const [user, dbUserById, monitorsCountResult] = await Promise.all([
    currentUser(),
    db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: userColumns,
    }),
    db
      .select({ count: count() })
      .from(monitors)
      .where(eq(monitors.userId, userId)),
  ]);

  // Fallback: if not found by Clerk ID, try by email (handles Clerk ID mismatch)
  // This prevents paying customers from seeing "FREE" badge due to ID sync issues
  let dbUser = dbUserById;
  if (!dbUser) {
    const clerkEmail = user?.emailAddresses[0]?.emailAddress;
    if (clerkEmail) {
      dbUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, clerkEmail),
        columns: userColumns,
      });
    }
  }

  // Block banned users from accessing the dashboard
  if (dbUser?.isBanned) {
    redirect("/banned");
  }

  // Track user activity for churn prevention (fire and forget, don't await)
  // Updates lastActiveAt to detect inactive users later
  db.update(users)
    .set({ lastActiveAt: new Date() })
    .where(eq(users.id, userId))
    .execute()
    .catch((err) => {
      console.warn("[layout] lastActiveAt update failed:", err?.message);
    });

  const hasMonitors = (monitorsCountResult[0]?.count || 0) > 0;
  // Use database onboardingCompleted as source of truth, fall back to hasMonitors for legacy users
  const onboardingCompleted = dbUser?.onboardingCompleted ?? hasMonitors;
  const isNewUser = !onboardingCompleted;
  const isAdmin = dbUser?.isAdmin || false;
  const subscriptionStatus = dbUser?.subscriptionStatus || "free";
  const userName = user?.firstName || user?.username || undefined;

  // Check if user has active day pass
  const hasActiveDayPass = dbUser?.dayPassExpiresAt ? new Date(dbUser.dayPassExpiresAt) > new Date() : false;

  // Map subscriptionStatus to userPlan type
  const userPlan = subscriptionStatus === "enterprise" ? "enterprise" : subscriptionStatus === "pro" ? "pro" : "free";

  // Get workspace role for team badge
  const workspaceRole = dbUser?.workspaceRole || null;

  // Get day pass expiration time for countdown timer
  const dayPassExpiresAt = hasActiveDayPass && dbUser?.dayPassExpiresAt
    ? new Date(dbUser.dayPassExpiresAt).toISOString()
    : null;

  return (
    <ResponsiveDashboardLayout
      isAdmin={isAdmin}
      subscriptionStatus={subscriptionStatus}
      hasActiveDayPass={hasActiveDayPass}
      dayPassExpiresAt={dayPassExpiresAt}
      workspaceRole={workspaceRole}
    >
      <RoutePreloader />
      <ServiceWorkerRegister />
      <DashboardClientWrapper isNewUser={isNewUser} userName={userName} userPlan={userPlan}>
        {children}
      </DashboardClientWrapper>
    </ResponsiveDashboardLayout>
  );
}
