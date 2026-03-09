import { NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { subscriptionStatus: true },
  });

  return NextResponse.json({
    plan: user?.subscriptionStatus || "free",
  });
}
