import { getEffectiveUserId } from "@/lib/dev-auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhooks, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// SECURITY (SEC-SSRF-001): Validate webhook URLs to prevent SSRF
function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be HTTPS in production
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    // Block private/internal IP ranges
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("192.168.") ||
      hostname === "169.254.169.254" || // AWS metadata
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) return false;
    return true;
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

// POST - Create new webhook
export async function POST(request: NextRequest) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    // Check if user is team tier
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true },
    });

    if (user?.subscriptionStatus !== "growth") {
      return NextResponse.json(
        { error: "Webhooks are only available for Team users" },
        { status: 403 }
      );
    }

    const body = await parseJsonBody(request);
    const { name, url, events, headers } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      );
    }

    // SECURITY (SEC-SSRF-001): Validate webhook URL before storing
    if (!isValidWebhookUrl(url)) {
      return NextResponse.json(
        { error: "Invalid webhook URL. Must be a public HTTPS URL." },
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
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    logger.error("Create webhook error", { error });
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    );
  }
}

// PUT - Update webhook
export async function PUT(request: NextRequest) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
    }

    const body = await parseJsonBody(request);
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

    // SECURITY (SEC-SSRF-001): Validate new URL if provided
    if (url && !isValidWebhookUrl(url)) {
      return NextResponse.json(
        { error: "Invalid webhook URL. Must be a public HTTPS URL." },
        { status: 400 }
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
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    logger.error("Update webhook error", { error });
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    );
  }
}

// DELETE - Delete webhook
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimit = await checkApiRateLimit(userId, 'write');
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } });
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
    logger.error("Delete webhook error", { error });
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    );
  }
}
