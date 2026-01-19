import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Email Forwarding Webhook
 *
 * Receives inbound emails to support@kaulbyapp.com via Resend webhook
 * and forwards them to support@steelmotionllc.com
 */

const INBOUND_EMAIL = "support@kaulbyapp.com"; // Only forward emails sent here
const FORWARD_TO = "vetsecitpro@gmail.com"; // Forward to personal Gmail (steelmotionllc MX points to Resend, not Google)
const SEND_FROM = "Kaulby Support <support@steelmotionllc.com>";

// Lazy-load to avoid build errors when env var is missing
let resendClient: Resend | null = null;
const getResend = () => resendClient ??= new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Resend wraps email data in "data" object
    const email = payload.data || payload;
    const { from, to, subject, text, html } = email;

    console.log("📧 Inbound email:", { from, to, subject });

    // Only forward emails sent to support@kaulbyapp.com (prevents loops)
    const toAddresses = Array.isArray(to) ? to : [to];
    const isForKaulby = toAddresses.some((addr: string) =>
      addr?.toLowerCase().includes(INBOUND_EMAIL.toLowerCase())
    );

    if (!isForKaulby) {
      console.log("⏭️ Ignoring email not addressed to:", INBOUND_EMAIL);
      return NextResponse.json({ received: true, forwarded: false });
    }

    // Forward the email
    const { error } = await getResend().emails.send({
      from: SEND_FROM,
      to: FORWARD_TO,
      replyTo: from, // Allow replying directly to original sender
      subject: `[Support] ${subject || "(no subject)"}`,
      text: `From: ${from}\n\n${text || "(no content)"}`,
      html: html ? `
        <div style="padding:12px;background:#f5f5f5;border-radius:8px;margin-bottom:16px;font-size:14px;">
          <strong>From:</strong> ${from}
        </div>
        ${html}
      ` : undefined,
    });

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

export async function GET() {
  return NextResponse.json({ status: "Email webhook active" });
}
