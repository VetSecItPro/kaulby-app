import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUserId } from "@/lib/dev-auth";
import { checkApiRateLimit, parseJsonBody, BodyTooLargeError } from "@/lib/rate-limit";
import { sanitizeUrl } from "@/lib/security";
import { generateTestPayload } from "@/lib/webhooks/events";
import crypto from "crypto";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/test
 *
 * Sends a test webhook payload to an arbitrary URL so users can verify
 * their Zapier/Make.com/n8n webhook endpoint works before saving it.
 *
 * Body: { url: string; secret?: string }
 * - url: The webhook URL to test
 * - secret: Optional HMAC secret to include a signature header
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getEffectiveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = await checkApiRateLimit(userId, "write");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) },
        },
      );
    }

    const body = await parseJsonBody(request);
    const { url, secret } = body as { url?: string; secret?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A webhook URL is required" },
        { status: 400 },
      );
    }

    // Validate URL is a proper https/http URL (blocks javascript:, data:, etc.)
    const sanitized = sanitizeUrl(url);
    if (!sanitized) {
      return NextResponse.json(
        { error: "Invalid webhook URL" },
        { status: 400 },
      );
    }

    // Build the test payload
    const testPayload = generateTestPayload();
    const payloadString = JSON.stringify(testPayload);

    // Headers - mimic what production deliveries send
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Kaulby-Webhook/1.0",
      "X-Webhook-Event": testPayload.event,
      "X-Webhook-Delivery-Id": `test-${Date.now()}`,
    };

    // HMAC signature when a secret is provided
    if (secret && typeof secret === "string") {
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payloadString)
        .digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    // Deliver
    const startTime = Date.now();
    let response: Response | undefined;
    let responseBody = "";
    let error: string | null = null;

    try {
      response = await fetch(sanitized, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10_000), // 10 s timeout for test
      });

      responseBody = await response.text().catch(() => "");
    } catch (fetchError) {
      error =
        fetchError instanceof Error ? fetchError.message : "Unknown error";
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: response?.ok ?? false,
      statusCode: response?.status ?? null,
      responseBody: responseBody.substring(0, 500),
      error,
      latencyMs,
      payloadSent: testPayload,
    });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 },
      );
    }
    logger.error("Webhook test error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to test webhook" },
      { status: 500 },
    );
  }
}
