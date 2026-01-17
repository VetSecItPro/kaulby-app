import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db, audiences } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { AudienceForm } from "@/components/dashboard/audience-form";

interface EditAudiencePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAudiencePage({ params }: EditAudiencePageProps) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Audience</h1>
        <p className="text-muted-foreground">
          Update your audience details.
        </p>
      </div>
      <AudienceForm audience={audience} />
    </div>
  );
}
