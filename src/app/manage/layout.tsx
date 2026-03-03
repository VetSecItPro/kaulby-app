import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ResponsiveDashboardLayout } from "@/components/dashboard/responsive-dashboard-layout";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SECURITY: Admin bypass requires explicit opt-in, never on Vercel — FIX-001
  const isLocalDev = process.env.NODE_ENV === "development" &&
                     process.env.ALLOW_DEV_AUTH_BYPASS === "true" &&
                     !process.env.VERCEL &&
                     !process.env.VERCEL_ENV;

  let subscriptionStatus: "free" | "pro" | "team" = "team";

  // In production (and non-opted-in dev), require auth and admin status
  if (!isLocalDev) {
    const { userId } = await auth();

    if (!userId) {
      redirect("/sign-in");
    }

    const userColumns = { isAdmin: true, subscriptionStatus: true } as const;
    let dbUser = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: userColumns,
    });

    // Fallback: if not found by Clerk ID, try by email (handles Clerk ID mismatch)
    // Mirrors the same fallback in (dashboard)/layout.tsx
    if (!dbUser) {
      const user = await currentUser();
      const clerkEmail = user?.emailAddresses[0]?.emailAddress;
      if (clerkEmail) {
        dbUser = await db.query.users.findFirst({
          where: (u, { eq }) => eq(u.email, clerkEmail),
          columns: userColumns,
        });

        // If found by email, update the Clerk ID so future lookups work directly
        if (dbUser) {
          db.update(users)
            .set({ updatedAt: new Date() })
            .where(eq(users.email, clerkEmail))
            .execute()
            .catch(() => {});
        }
      }
    }

    if (!dbUser?.isAdmin) {
      redirect("/dashboard");
    }

    subscriptionStatus = dbUser?.subscriptionStatus || "free";
  }

  return (
    <ResponsiveDashboardLayout isAdmin={true} subscriptionStatus={subscriptionStatus}>
      {children}
    </ResponsiveDashboardLayout>
  );
}
