import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";

export async function POST() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .update(users)
      .set({ tosAcceptedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ accepted: true });
  } catch (error) {
    console.error("Error accepting ToS:", error);
    return NextResponse.json({ error: "Failed to accept terms" }, { status: 500 });
  }
}
