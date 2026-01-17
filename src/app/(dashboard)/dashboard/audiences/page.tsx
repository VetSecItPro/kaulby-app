import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, audiences, audienceMonitors } from "@/lib/db";
import { eq } from "drizzle-orm";
import { AudiencesList } from "@/components/dashboard/audiences-list";

export default async function AudiencesPage() {
  const { userId } = await auth();

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV;

  if (!userId && isProduction) {
    redirect("/sign-in");
  }

  // Fetch audiences for the authenticated user
  const userAudiences = userId
    ? await db.query.audiences.findMany({
        where: eq(audiences.userId, userId),
        orderBy: (audiences, { desc }) => [desc(audiences.createdAt)],
      })
    : [];

  // For each audience, get monitor count
  const audiencesWithCounts = await Promise.all(
    userAudiences.map(async (audience) => {
      const monitorLinks = await db.query.audienceMonitors.findMany({
        where: eq(audienceMonitors.audienceId, audience.id),
      });
      return {
        ...audience,
        monitorCount: monitorLinks.length,
      };
    })
  );

  return <AudiencesList audiences={audiencesWithCounts} />;
}
