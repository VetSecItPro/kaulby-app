import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AudienceForm } from "@/components/dashboard/audience-form";

export default async function NewAudiencePage() {
  const { userId } = await auth();

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV;

  if (!userId && isProduction) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Audience</h1>
        <p className="text-muted-foreground">
          Create a new audience to group related monitors together.
        </p>
      </div>
      <AudienceForm />
    </div>
  );
}
