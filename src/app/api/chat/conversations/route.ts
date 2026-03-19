import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations } from "@/lib/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { getUserPlan } from "@/lib/limits";
import { isValidUuid, escapeHtml } from "@/lib/security";
import { checkApiRateLimit } from "@/lib/rate-limit";

// Conversation limits by plan
const CONVERSATION_LIMITS: Record<string, number> = {
  free: 0, // No AI chat access
  pro: 50,
  team: -1, // Unlimited
};

// GET - List conversations for the current user
export async function GET() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security: Rate limit conversation listing
    const rateLimit = await checkApiRateLimit(userId, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const conversations = await db.query.chatConversations.findMany({
      where: eq(chatConversations.userId, userId),
      orderBy: [desc(chatConversations.updatedAt)],
      columns: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error listing conversations:", error);
    return NextResponse.json({ error: "Failed to list conversations" }, { status: 500 });
  }
}

// POST - Create a new conversation
export async function POST(req: Request) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security: Rate limit conversation creation
    const writeRateLimit = await checkApiRateLimit(userId, "write");
    if (!writeRateLimit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const plan = await getUserPlan(userId);
    if (plan !== "pro" && plan !== "team") {
      return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
    }

    // Check conversation limit
    const limit = CONVERSATION_LIMITS[plan] ?? 0;
    if (limit !== -1) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(chatConversations)
        .where(eq(chatConversations.userId, userId));
      if (value >= limit) {
        return NextResponse.json(
          { error: `Conversation limit reached (${limit}). Delete older conversations to create new ones.` },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));

    let title = "New conversation";
    if (typeof body.title === "string" && body.title.trim()) {
      title = escapeHtml(body.title.trim().slice(0, 200));
    }

    const [conversation] = await db
      .insert(chatConversations)
      .values({ userId, title })
      .returning({
        id: chatConversations.id,
        title: chatConversations.title,
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
      });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}

// DELETE - Delete a conversation (and its messages via cascade)
export async function DELETE(req: Request) {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const id = body.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }

    if (!isValidUuid(id)) {
      return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
    }

    await db
      .delete(chatConversations)
      .where(and(eq(chatConversations.id, id), eq(chatConversations.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
