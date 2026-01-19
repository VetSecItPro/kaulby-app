import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";

// Lazy-load Resend client to avoid build errors when env var is missing
let resend: Resend | null = null;
function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Inbound: emails sent to this address
const INBOUND_EMAIL = "support@kaulbyapp.com";
// Forward to: where emails get redirected
const FORWARD_TO = "support@steelmotionllc.com";
// Send from: must be a verified sending domain in Resend
const SEND_FROM = "support@steelmotionllc.com";

/**
 * Verify Resend webhook signature (Svix-based)
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  // Skip verification in development or if no secret configured
  if (!secret || process.env.NODE_ENV === "development") {
    return true;
  }

  if (!signature || !timestamp) {
    return false;
  }

  // Resend uses Svix for webhooks - signature format: v1,signature
  const signedPayload = `${timestamp}.${payload}`;
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
  const expectedSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedPayload)
    .digest("base64");

  // Check if any of the provided signatures match
  const signatures = signature.split(" ");
  return signatures.some((sig) => {
    const [, sigValue] = sig.split(",");
    return sigValue === expectedSignature;
  });
}

/**
 * POST /api/webhooks/email - Receive inbound emails from Resend
 *
 * Resend sends inbound emails as webhook payloads.
 * We forward support@kaulbyapp.com emails to support@steelmotionllc.com
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, svixSignature, svixTimestamp)) {
      console.error("Invalid webhook signature", { svixId });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);

    // Resend wraps email data in a "data" object
    const emailData = payload.data || payload;

    // Log for debugging
    console.log("Inbound email webhook received:", {
      type: payload.type,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
    });

    // Extract email details from Resend's inbound email format
    const {
      from,
      to,
      subject,
      text,
      html,
    } = emailData;

    // Only process emails to support@kaulbyapp.com
    const toAddresses = Array.isArray(to) ? to : [to];
    const isSupport = toAddresses.some((addr: string) =>
      addr.toLowerCase().includes(INBOUND_EMAIL.toLowerCase())
    );

    if (!isSupport) {
      console.log("Ignoring non-support email to:", to);
      return NextResponse.json({ received: true, forwarded: false });
    }

    // Forward the email using verified sending domain
    const { error } = await getResendClient().emails.send({
      from: `Kaulby Support <${SEND_FROM}>`,
      to: FORWARD_TO,
      subject: `[Support] ${subject || "(no subject)"}`,
      text: `
--- Forwarded Support Email ---
From: ${from}
To: ${toAddresses.join(", ")}
Subject: ${subject || "(no subject)"}
---

${text || "(no text content)"}
      `.trim(),
      html: html ? `
        <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 16px;">
          <strong>Forwarded Support Email</strong><br>
          <small>From: ${from}</small><br>
          <small>To: ${toAddresses.join(", ")}</small>
        </div>
        ${html}
      ` : undefined,
    });

    if (error) {
      console.error("Failed to forward email:", error);
      return NextResponse.json(
        { error: "Failed to forward email" },
        { status: 500 }
      );
    }

    console.log("Email forwarded successfully to:", FORWARD_TO);
    return NextResponse.json({ received: true, forwarded: true });

  } catch (error) {
    console.error("Email webhook error:", error instanceof Error ? error.message : error);
    console.error("Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Webhook processing failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Resend may send GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: "Email webhook active" });
}
