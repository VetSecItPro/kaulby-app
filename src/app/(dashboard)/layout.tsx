import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardClientWrapper } from "@/components/dashboard/dashboard-client-wrapper";
import { ResponsiveDashboardLayout } from "@/components/dashboard/responsive-dashboard-layout";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
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
        {children}
      </ResponsiveDashboardLayout>
    );
  }

  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user data and monitor count in parallel
  const [dbUser, monitorsCountResult] = await Promise.all([
    db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: { isAdmin: true, subscriptionStatus: true },
    }),
    db
      .select({ count: count() })
      .from(monitors)
      .where(eq(monitors.userId, userId)),
  ]);

  const hasMonitors = (monitorsCountResult[0]?.count || 0) > 0;
  const isNewUser = !hasMonitors;
  const isAdmin = dbUser?.isAdmin || false;
  const subscriptionStatus = dbUser?.subscriptionStatus || "free";
  const userName = user?.firstName || user?.username || undefined;

  return (
    <ResponsiveDashboardLayout isAdmin={isAdmin} subscriptionStatus={subscriptionStatus}>
      <DashboardClientWrapper isNewUser={isNewUser} userName={userName}>
        {children}
      </DashboardClientWrapper>
    </ResponsiveDashboardLayout>
  );
}
