import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

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
    const payload = await request.json();

    // SECURITY: Log metadata only — FIX-011
    console.log("📧 Email webhook received:", { type: (payload as Record<string,unknown>)?.type });

    // Resend wraps email data in "data" object
    const email = payload.data || payload;
    const { from, to, subject } = email;
    let { text, html } = email;

    // Extract clean email for Reply-To
    const originalSenderEmail = extractEmail(from);
    console.log("📧 Original sender extracted:", originalSenderEmail);

    // If body is missing, fetch full inbound email using Resend's receiving API
    if (!text && !html && email.email_id) {
      console.log("📧 Body missing, fetching inbound email:", email.email_id);
      try {
        const response = await fetch(`https://api.resend.com/emails/receiving/${email.email_id}`, {
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          },
        });
        if (response.ok) {
          const fullEmail = await response.json();
          // SECURITY: Log metadata only — FIX-011
          console.log("📧 Inbound email processed");
          text = fullEmail.text;
          html = fullEmail.html;
        } else {
          console.error("Failed to fetch inbound email:", response.status, await response.text());
        }
      } catch (fetchErr) {
        console.error("Failed to fetch inbound email:", fetchErr);
      }
    }

    console.log("📧 Final fields:", { from, to, subject, hasText: !!text, hasHtml: !!html });

    // Only forward emails sent to support@kaulbyapp.com (prevents loops)
    const toAddresses = Array.isArray(to) ? to : [to];
    const isForKaulby = toAddresses.some((addr: string) =>
      addr?.toLowerCase().includes(INBOUND_EMAIL.toLowerCase())
    );

    if (!isForKaulby) {
      console.log("⏭️ Ignoring email not addressed to:", INBOUND_EMAIL);
      return NextResponse.json({ received: true, forwarded: false });
    }

    // Forward the email with Reply-To set to original sender
    const { error } = await getResend().emails.send({
      from: SEND_FROM,
      to: FORWARD_TO,
      replyTo: originalSenderEmail, // Clean email for Reply-To header
      subject: `[Support] ${subject || "(no subject)"}`,
      text: `Original sender: ${from}\nReply-To: ${originalSenderEmail}\n\n${text || "(no content)"}`,
      html: html ? `
        <div style="padding:12px;background:#f5f5f5;border-radius:8px;margin-bottom:16px;font-size:14px;">
          <strong>From:</strong> ${from}<br/>
          <small style="color:#666;">Reply will go to: ${originalSenderEmail}</small>
        </div>
        ${html}
      ` : undefined,
    });

    console.log("📧 Forwarding with Reply-To:", originalSenderEmail);

    if (error) {
      console.error("❌ Forward failed:", error);
      return NextResponse.json({ error: "Forward failed" }, { status: 500 });
    }

    console.log("✅ Forwarded to:", FORWARD_TO);
    return NextResponse.json({ received: true, forwarded: true });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
