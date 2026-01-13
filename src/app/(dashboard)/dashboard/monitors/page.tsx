import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ResponsiveMonitors } from "@/components/dashboard/responsive-monitors";

export default async function MonitorsPage() {
  const isDev = process.env.NODE_ENV === "development";

  let userId: string | null = null;

  if (!isDev) {
    const authResult = await auth();
    userId = authResult.userId;

    if (!userId) {
      redirect("/sign-in");
    }
  }

  // In dev mode, show empty list or mock data
  const userMonitors = userId
    ? await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
        orderBy: [desc(monitors.createdAt)],
      })
    : [];

  return <ResponsiveMonitors monitors={userMonitors} />;
}
