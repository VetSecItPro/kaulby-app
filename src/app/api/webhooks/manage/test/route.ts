import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// POST - Send test webhook
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Webhook ID is required" },
        { status: 400 }
      );
    }

    // Get webhook
    const webhook = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
    });

    if (!webhook) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404 }
      );
    }

    // Prepare test payload
    const testPayload = {
      eventType: "test",
      data: {
        message: "This is a test webhook from Kaulby",
        webhookId: webhook.id,
        webhookName: webhook.name,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    const payloadString = JSON.stringify(testPayload);

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": "test",
      "X-Webhook-Delivery-Id": `test-${Date.now()}`,
      ...(webhook.headers as Record<string, string> || {}),
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = crypto
        .createHmac("sha256", webhook.secret)
        .update(payloadString)
        .digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    // Send test webhook
    const startTime = Date.now();
    let response;
    let responseBody = "";
    let error = null;

    try {
      response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout for test
      });

      responseBody = await response.text().catch(() => "");
    } catch (fetchError) {
      error = fetchError instanceof Error ? fetchError.message : "Unknown error";
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: response?.ok ?? false,
      statusCode: response?.status,
      responseBody: responseBody.substring(0, 500),
      error,
      latencyMs,
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    return NextResponse.json(
      { error: "Failed to test webhook" },
      { status: 500 }
    );
  }
}
