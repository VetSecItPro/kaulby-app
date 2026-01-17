import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db, audiences, audienceMonitors, results, monitors } from "@/lib/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { AudienceDetail } from "@/components/dashboard/audience-detail";

interface AudiencePageProps {
  params: Promise<{ id: string }>;
}

export default async function AudiencePage({ params }: AudiencePageProps) {
  const { userId } = await auth();
  const { id } = await params;

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV;

  if (!userId && isProduction) {
    redirect("/sign-in");
  }

  // Fetch the audience
  const audience = userId
    ? await db.query.audiences.findFirst({
        where: and(eq(audiences.id, id), eq(audiences.userId, userId)),
      })
    : null;

  if (!audience) {
    notFound();
  }

  // Get monitors through junction table
  const audienceMonitorLinks = await db.query.audienceMonitors.findMany({
    where: eq(audienceMonitors.audienceId, id),
    with: {
      monitor: true,
    },
  });

  const audienceMonitorsList = audienceMonitorLinks.map((am) => am.monitor);
  const monitorIds = audienceMonitorsList.map((m) => m.id);

  // Get recent results from all monitors in this audience
  let recentResults: (typeof results.$inferSelect)[] = [];
  if (monitorIds.length > 0) {
    recentResults = await db.query.results.findMany({
      where: inArray(results.monitorId, monitorIds),
      orderBy: [desc(results.createdAt)],
      limit: 50,
    });
  }

  // Get all user's monitors for the "add monitor" dropdown
  const allUserMonitors = userId
    ? await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
        orderBy: [desc(monitors.createdAt)],
      })
    : [];

  // Filter out monitors already in this audience
  const availableMonitors = allUserMonitors.filter(
    (m) => !monitorIds.includes(m.id)
  );

  return (
    <AudienceDetail
      audience={audience}
      monitors={audienceMonitorsList}
      results={recentResults}
      availableMonitors={availableMonitors}
    />
  );
}
