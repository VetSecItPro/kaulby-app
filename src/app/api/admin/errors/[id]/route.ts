import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { errorLogs, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/errors/[id]
 * Get a single error log with full details
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const errorLog = await db.query.errorLogs.findFirst({
    where: eq(errorLogs.id, id),
  });

  if (!errorLog) {
    return NextResponse.json({ error: "Error log not found" }, { status: 404 });
  }

  return NextResponse.json(errorLog);
}

/**
 * PATCH /api/admin/errors/[id]
 * Update an error log (resolve, add notes)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { resolved, notes } = body;

  const errorLog = await db.query.errorLogs.findFirst({
    where: eq(errorLogs.id, id),
  });

  if (!errorLog) {
    return NextResponse.json({ error: "Error log not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof resolved === "boolean") {
    updates.resolved = resolved;
    if (resolved) {
      updates.resolvedAt = new Date();
      updates.resolvedBy = userId;
    } else {
      updates.resolvedAt = null;
      updates.resolvedBy = null;
    }
  }

  if (typeof notes === "string") {
    updates.notes = notes;
  }

  const [updated] = await db
    .update(errorLogs)
    .set(updates)
    .where(eq(errorLogs.id, id))
    .returning();

  return NextResponse.json(updated);
}

/**
 * DELETE /api/admin/errors/[id]
 * Delete an error log
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  await db.delete(errorLogs).where(eq(errorLogs.id, id));

  return NextResponse.json({ success: true });
}
