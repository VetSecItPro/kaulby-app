import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ResponsiveMonitors } from "@/components/dashboard/responsive-monitors";

export default async function MonitorsPage() {
  const { userId } = await auth();

  // In production, redirect to sign-in if not authenticated
  // In dev mode, userId may be null but we still query (returns empty)
  const isProduction = process.env.NODE_ENV === "production" ||
                       process.env.VERCEL ||
                       process.env.VERCEL_ENV;

  if (!userId && isProduction) {
    redirect("/sign-in");
  }

  // Fetch monitors for the authenticated user
  const userMonitors = userId
    ? await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
        orderBy: [desc(monitors.createdAt)],
      })
    : [];

  return <ResponsiveMonitors monitors={userMonitors} />;
}
