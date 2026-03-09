import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml, sanitizeForLog } from "@/lib/security";
import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
// PERF: Email webhook processing may take longer than default 10s — FIX-016
export const maxDuration = 60;

/**
 * Email Forwarding Webhook
 *
 * Receives inbound emails to support@kaulbyapp.com via Resend webhook
 * and forwards them to support@steelmotionllc.com
 */

const INBOUND_EMAIL = "support@kaulbyapp.com"; // Only forward emails sent here
const FORWARD_TO = "support@steelmotionllc.com";
// IMPORTANT: Use forwarded@ instead of support@ to avoid Gmail "Send As" conflict
// Gmail ignores Reply-To if the From address matches a "Send mail as" account
const SEND_FROM = "Kaulby Support <forwarded@kaulbyapp.com>";

// Lazy-load to avoid build errors when env var is missing
let resendClient: Resend | null = null;
const getResend = () => resendClient ??= new Resend(process.env.RESEND_API_KEY);

// Extract email address from various formats: "email@example.com" or "Name <email@example.com>"
function extractEmail(input: string | string[] | undefined): string | undefined {
  if (!input) return undefined;
  const str = Array.isArray(input) ? input[0] : input;
  const match = str.match(/<([^>]+)>/) || str.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1] : str;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY (SEC-AUTH-001): Verify Resend webhook secret (mandatory)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[email-webhook] RESEND_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }
    const signature = request.headers.get("resend-signature") || request.headers.get("x-resend-signature");
    if (!signature || signature !== webhookSecret) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = await request.json();

    // SECURITY: Metadata only — FIX-011

    // Resend wraps email data in "data" object
    const email = payload.data || payload;

    // SECURITY (SEC-INTEG-008): Idempotency guard — prevent duplicate email forwarding
    const eventId = email.email_id || payload.id || `resend-${Date.now()}`;
    try {
      await db.insert(webhookEvents).values({
        eventId,
        eventType: (payload as Record<string, unknown>)?.type as string || "email.received",
        provider: "resend",
      });
    } catch (dupError: unknown) {
      if (dupError instanceof Error && dupError.message?.includes("unique")) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw dupError;
    }
    const { from, to, subject } = email;
    let { text, html } = email;

    // Extract clean email for Reply-To
    const originalSenderEmail = extractEmail(from);
    // SECURITY (SEC-INJ-002): Sanitize log output to prevent log injection

    // If body is missing, fetch full inbound email using Resend's receiving API
    if (!text && !html && email.email_id) {
      console.warn("[email-webhook] Body missing, fetching:", sanitizeForLog(email.email_id));
      try {
        const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(email.email_id)}`, {
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          },
        });
        if (response.ok) {
          const fullEmail = await response.json();
          // Body fetched successfully
          text = fullEmail.text;
          html = fullEmail.html;
        } else {
          console.error("Failed to fetch inbound email:", response.status);
        }
      } catch (fetchErr) {
        console.error("Failed to fetch inbound email:", fetchErr);
      }
    }

    // Fields extracted — proceeding to forward check

    // Only forward emails sent to support@kaulbyapp.com (prevents loops)
    const toAddresses = Array.isArray(to) ? to : [to];
    const isForKaulby = toAddresses.some((addr: string) =>
      addr?.toLowerCase().includes(INBOUND_EMAIL.toLowerCase())
    );

    if (!isForKaulby) {
      // Not addressed to support inbox — skip forwarding
      return NextResponse.json({ received: true, forwarded: false });
    }

    // SECURITY (SEC-INJ-003): Escape HTML in forwarded email to prevent injection
    const safeSender = escapeHtml(from ?? "unknown");
    const safeReplyTo = escapeHtml(originalSenderEmail ?? "unknown");

    // Forward the email with Reply-To set to original sender
    const { error } = await getResend().emails.send({
      from: SEND_FROM,
      to: FORWARD_TO,
      replyTo: originalSenderEmail, // Clean email for Reply-To header
      subject: `[Support] ${subject || "(no subject)"}`,
      text: `Original sender: ${from}\nReply-To: ${originalSenderEmail}\n\n${text || "(no content)"}`,
      html: html ? `
        <div style="padding:12px;background:#f5f5f5;border-radius:8px;margin-bottom:16px;font-size:14px;">
          <strong>From:</strong> ${safeSender}<br/>
          <small style="color:#666;">Reply will go to: ${safeReplyTo}</small>
        </div>
        ${html}
      ` : undefined,
    });

    // Email forwarded with Reply-To to original sender

    if (error) {
      console.error("Forward failed:", error);
      return NextResponse.json({ error: "Forward failed" }, { status: 500 });
    }

    // Successfully forwarded
    return NextResponse.json({ received: true, forwarded: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
