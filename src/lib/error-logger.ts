import { db } from "@/lib/db";
import { errorLogs } from "@/lib/db/schema";

type ErrorLevel = "error" | "warning" | "fatal";
type ErrorSource = "api" | "inngest" | "ai" | "webhook" | "auth";

interface LogErrorOptions {
  level?: ErrorLevel;
  source: ErrorSource;
  message: string;
  error?: unknown;
  userId?: string;
  endpoint?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
}

/**
 * Log an error to the error_logs table for the admin dashboard.
 * Fire-and-forget: never throws, never blocks the caller.
 */
export function logError(opts: LogErrorOptions): void {
  const stack =
    opts.error instanceof Error ? opts.error.stack : undefined;

  db.insert(errorLogs)
    .values({
      level: opts.level ?? "error",
      source: opts.source,
      message: opts.message,
      stack: stack ?? null,
      userId: opts.userId ?? null,
      endpoint: opts.endpoint ?? null,
      statusCode: opts.statusCode ?? null,
      context: opts.context ?? null,
    })
    .execute()
    .catch((insertErr) => {
      // Last resort: console so it appears in server logs
      console.error("[logError] Failed to write error_logs row:", insertErr);
    });
}
