import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhooks, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// POST - Create new webhook
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is enterprise
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true },
    });

    if (user?.subscriptionStatus !== "enterprise") {
      return NextResponse.json(
        { error: "Webhooks are only available for Enterprise users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, url, events, headers } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      );
    }

    // Generate a secret for HMAC signature
    const secret = crypto.randomBytes(32).toString("hex");

    const [webhook] = await db
      .insert(webhooks)
      .values({
        userId,
        name,
        url,
        secret,
        events: events || ["new_result"],
        headers: headers || {},
        isActive: true,
      })
      .returning();

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error("Create webhook error:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}

// PUT - Update webhook
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, url, events, headers, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Webhook ID is required" },
        { status: 400 }
      );
    }

    // Verify webhook belongs to user
    const existing = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    const [webhook] = await db
      .update(webhooks)
      .set({
        name: name ?? existing.name,
        url: url ?? existing.url,
        events: events ?? existing.events,
        headers: headers ?? existing.headers,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, id))
      .returning();

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error("Update webhook error:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

// DELETE - Delete webhook
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Webhook ID is required" },
        { status: 400 }
      );
    }

    // Verify webhook belongs to user
    const existing = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    await db.delete(webhooks).where(eq(webhooks.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete webhook error:", error);
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}
