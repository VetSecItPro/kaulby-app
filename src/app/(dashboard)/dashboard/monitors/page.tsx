import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { monitors } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ResponsiveMonitors } from "@/components/dashboard/responsive-monitors";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export default async function MonitorsPage() {
  const effectiveUserId = await getEffectiveUserId();

  if (!effectiveUserId && !isLocalDev()) {
    redirect("/sign-in");
  }

  // Fetch monitors for the authenticated user
  const userMonitors = effectiveUserId
    ? await db.query.monitors.findMany({
        where: eq(monitors.userId, effectiveUserId),
        orderBy: [desc(monitors.createdAt)],
      })
    : [];

  return <ResponsiveMonitors monitors={userMonitors} />;
}
