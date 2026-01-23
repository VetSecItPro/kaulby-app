import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ResponsiveDashboardLayout } from "@/components/dashboard/responsive-dashboard-layout";
import { db } from "@/lib/db";

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDev = process.env.NODE_ENV === "development";

  let subscriptionStatus: "free" | "pro" | "enterprise" = "enterprise";

  // In production, require auth and admin status
  if (!isDev) {
    const { userId } = await auth();

    if (!userId) {
      redirect("/sign-in");
    }

    const dbUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: { isAdmin: true, subscriptionStatus: true },
    });

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
