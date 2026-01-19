import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DeletionRequestedClient } from "./deletion-requested-client";

export default async function DeletionRequestedPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      deletionRequestedAt: true,
      email: true,
    },
  });

  // If no deletion requested, redirect to settings
  if (!user?.deletionRequestedAt) {
    redirect("/dashboard/settings");
  }

  const deletionDate = new Date(user.deletionRequestedAt);
  deletionDate.setDate(deletionDate.getDate() + 7);

  return (
    <DeletionRequestedClient
      email={user.email}
      deletionDate={deletionDate.toISOString()}
    />
  );
}
