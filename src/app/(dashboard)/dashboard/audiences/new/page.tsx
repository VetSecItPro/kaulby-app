import { redirect } from "next/navigation";
import { AudienceForm } from "@/components/dashboard/audience-form";
import { getEffectiveUserId, isLocalDev } from "@/lib/dev-auth";

export default async function NewAudiencePage() {
  const userId = await getEffectiveUserId();

  if (!userId && !isLocalDev()) {
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
