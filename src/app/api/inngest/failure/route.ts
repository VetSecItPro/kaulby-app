/**
 * Inngest Failure Webhook
 *
 * Receives notifications when Inngest functions exhaust all retries.
 * Logs to console and sends admin alert via email/Slack.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { function_id, event, error: errorMsg, run_id } = body;

    logger.error("[Inngest] Function permanently failed", {
      functionId: function_id,
      runId: run_id,
      error: errorMsg,
      event: event?.name,
    });

    // Send admin notification if ADMIN_ALERT_EMAIL is configured
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (adminEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Kaulby System <alerts@kaulbyapp.com>",
          to: adminEmail,
          subject: `[ALERT] Inngest function failed: ${function_id}`,
          text: `Function: ${function_id}\nRun ID: ${run_id}\nEvent: ${event?.name || "N/A"}\nError: ${errorMsg || "Unknown"}\n\nCheck Inngest dashboard for details.`,
        });
      } catch (emailErr) {
        logger.error("[Inngest] Failed to send admin alert email", {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      }
    }

    // Send Slack notification if configured
    const slackUrl = process.env.ADMIN_SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try {
        await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            text: `*Inngest Function Failed*\n*Function:* ${function_id}\n*Error:* ${errorMsg || "Unknown"}\n*Run ID:* ${run_id}`,
          }),
        });
      } catch {
        // Don't let Slack failure crash the webhook
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("[Inngest] Failure webhook error", { error });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
