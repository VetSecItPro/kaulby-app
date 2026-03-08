/**
 * Resilient email sending with retry + failure tracking.
 * No silent failures — every failed email is recorded in the database.
 */

import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { pooledDb } from "@/lib/db";
import { emailDeliveryFailures } from "@/lib/db/schema";

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string }>;
  // Tracking metadata
  emailType: string;
  userId?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Classify whether a Resend error is transient (worth retrying) or permanent.
 */
function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const transientPatterns = [
    /rate limit/i,
    /429/,
    /500/,
    /502/,
    /503/,
    /504/,
    /timeout/i,
    /ECONNRESET/,
    /ECONNREFUSED/,
    /ETIMEDOUT/,
    /network/i,
    /fetch failed/i,
  ];
  return transientPatterns.some((p) => p.test(message));
}

/**
 * Send an email with up to 3 retries and exponential backoff.
 * Records failures in the database for visibility.
 */
export async function sendEmailWithRetry(params: SendEmailParams): Promise<SendResult> {
  const maxRetries = 3;
  const { emailType, userId } = params;
  let lastError: unknown;

  // Build the Resend payload dynamically — cast needed because Resend's union type
  // requires exactly one of html/text/react, but we accept either at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resendPayload: any = {
    from: params.from,
    to: params.to,
    subject: params.subject,
    ...(params.html ? { html: params.html } : {}),
    ...(params.text ? { text: params.text } : {}),
    ...(params.attachments ? { attachments: params.attachments } : {}),
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await getResend().emails.send(resendPayload);
      // Success on retry — log recovery
      if (attempt > 0) {
        logger.info("[Email] Recovered after retry", {
          emailType,
          recipient: params.to,
          attempt,
        });
      }
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      lastError = error;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Don't retry permanent errors (invalid email, auth failure, etc.)
      if (!isTransientError(error)) {
        logger.error("[Email] Permanent failure — not retrying", {
          emailType,
          recipient: params.to,
          error: errorMsg,
        });
        break;
      }

      // Retry with exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        logger.warn("[Email] Transient failure — retrying", {
          emailType,
          recipient: params.to,
          attempt: attempt + 1,
          nextRetryMs: delayMs,
          error: errorMsg,
        });
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  // All retries exhausted — record failure in database
  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  try {
    await pooledDb.insert(emailDeliveryFailures).values({
      userId: userId || null,
      emailType,
      recipient: params.to,
      subject: params.subject,
      errorMessage: errorMsg,
      retryCount: maxRetries,
      maxRetries,
    });
  } catch (dbError) {
    // Don't let DB logging failure mask the original email error
    logger.error("[Email] Failed to record delivery failure in DB", {
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
  }

  logger.error("[Email] All retries exhausted", {
    emailType,
    recipient: params.to,
    error: errorMsg,
    retries: maxRetries,
  });

  return { success: false, error: errorMsg };
}
