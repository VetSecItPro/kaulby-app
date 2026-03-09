import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { isValidUuid } from "@/lib/security";

// Max messages per conversation to prevent abuse
const MAX_MESSAGES_PER_CONVERSATION = 200;
// Max content length per message (characters)
const MAX_MESSAGE_LENGTH = 10_000;
// Max messages per save request
const MAX_BATCH_SIZE = 10;

// GET - Load messages for a conversation
export async function GET(req: Request) {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // Validate UUID format
  if (!isValidUuid(conversationId)) {
    return NextResponse.json({ error: "Invalid conversationId" }, { status: 400 });
  }

  // Verify conversation belongs to authenticated user — prevents IDOR attacks
  const conversation = await db.query.chatConversations.findFirst({
    where: and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, userId)
    ),
    columns: { id: true },
  });

  if (!conversation) {
    // Return 404 (not 403) to avoid leaking existence of conversations
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.conversationId, conversationId),
    orderBy: [asc(chatMessages.createdAt)],
  });

  return NextResponse.json({ messages });
}

// POST - Save messages to a conversation
export async function POST(req: Request) {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { conversationId, messages } = body as {
    conversationId: unknown;
    messages: unknown;
  };

  // Validate conversationId
  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }
  if (!isValidUuid(conversationId)) {
    return NextResponse.json({ error: "Invalid conversationId" }, { status: 400 });
  }

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages must be a non-empty array" }, { status: 400 });
  }
  if (messages.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: `Max ${MAX_BATCH_SIZE} messages per request` }, { status: 400 });
  }

  // Validate each message
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
    }
    if (msg.role !== "user" && msg.role !== "assistant") {
      return NextResponse.json({ error: "Invalid message role" }, { status: 400 });
    }
    if (typeof msg.content !== "string" || msg.content.length === 0) {
      return NextResponse.json({ error: "Message content required" }, { status: 400 });
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, { status: 400 });
    }
  }

  // Verify conversation belongs to authenticated user — prevents IDOR attacks
  const conversation = await db.query.chatConversations.findFirst({
    where: and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, userId)
    ),
    columns: { id: true, title: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Type-safe cast after validation above
  const validatedMessages = messages as {
    role: "user" | "assistant";
    content: string;
    citations?: unknown;
    toolsUsed?: unknown;
  }[];

  // Insert messages — content is stored as-is (rendered with escaping on the client via React's JSX which auto-escapes)
  const inserted = await db
    .insert(chatMessages)
    .values(
      validatedMessages.map((m) => ({
        conversationId,
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_LENGTH),
        citations: m.citations as typeof chatMessages.$inferInsert.citations,
        toolsUsed: m.toolsUsed as typeof chatMessages.$inferInsert.toolsUsed,
      }))
    )
    .returning({ id: chatMessages.id });

  // Update conversation title from first user message if still default
  if (conversation.title === "New conversation") {
    const firstUserMsg = validatedMessages.find((m) => m.role === "user");
    if (firstUserMsg) {
      const title = firstUserMsg.content.slice(0, 100) + (firstUserMsg.content.length > 100 ? "..." : "");
      await db
        .update(chatConversations)
        .set({ title, updatedAt: new Date() })
        .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
    }
  } else {
    await db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)));
  }

  return NextResponse.json({ saved: inserted.length });
}
