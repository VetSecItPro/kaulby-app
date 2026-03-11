import { db } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { redirect } from "next/navigation";
import { FeedbackDashboard } from "@/components/admin/feedback-dashboard";

export default async function FeedbackPage() {
  const userId = await getEffectiveUserId();
  if (!userId) redirect("/sign-in");

  // Verify admin
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: { isAdmin: true },
  });
  if (!user?.isAdmin) redirect("/dashboard");

  // Fetch all feedback, newest first
  const allFeedback = await db.query.feedback.findMany({
    orderBy: [desc(feedback.createdAt)],
    limit: 200,
  });

  // Stats
  const stats = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${feedback.status} = 'open')::int`,
      inProgress: sql<number>`count(*) filter (where ${feedback.status} = 'in_progress')::int`,
      bugs: sql<number>`count(*) filter (where ${feedback.category} = 'bug')::int`,
      features: sql<number>`count(*) filter (where ${feedback.category} = 'feature')::int`,
    })
    .from(feedback);

  return (
    <FeedbackDashboard
      feedback={allFeedback.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      }))}
      stats={stats[0] || { total: 0, open: 0, inProgress: 0, bugs: 0, features: 0 }}
    />
  );
}
