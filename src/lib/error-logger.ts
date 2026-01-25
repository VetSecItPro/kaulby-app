/**
 * Error Logger Module
 *
 * Centralized error logging for the admin dashboard.
 * Captures errors from APIs, Inngest functions, AI calls, webhooks, and auth.
 * Use logError() throughout the codebase instead of console.error() alone.
 */

import { db } from "@/lib/db";
import { errorLogs } from "@/lib/db/schema";

// ============================================================================
// TYPES
// ============================================================================

export type ErrorLevel = "error" | "warning" | "fatal";
export type ErrorSource = "api" | "inngest" | "ai" | "webhook" | "auth" | "cron" | "database";

export interface ErrorLogOptions {
  level?: ErrorLevel;
  source: ErrorSource;
  message: string;
  error?: Error | unknown;
  context?: Record<string, unknown>;
  requestId?: string;
  userId?: string;
  endpoint?: string;
  statusCode?: number;
  duration?: number;
}

// ============================================================================
// LOGGER
// ============================================================================

/**
 * Log an error to the database for admin review
 *
 * @example
 * ```typescript
 * // In an API route
 * try {
 *   await someOperation();
 * } catch (error) {
 *   await logError({
 *     source: "api",
 *     message: "Failed to process request",
 *     error,
 *     endpoint: "/api/monitors",
 *     userId: user.id,
 *   });
 *   return NextResponse.json({ error: "Internal error" }, { status: 500 });
 * }
 *
 * // In an Inngest function
 * await logError({
 *   source: "inngest",
 *   message: "Monitor scan failed",
 *   error,
 *   context: { monitorId, platform },
 * });
 * ```
 */
export async function logError(options: ErrorLogOptions): Promise<string | null> {
  const {
    level = "error",
    source,
    message,
    error,
    context,
    requestId,
    userId,
    endpoint,
    statusCode,
    duration,
  } = options;

  // Extract stack trace from error
  let stack: string | undefined;
  if (error instanceof Error) {
    stack = error.stack;
  } else if (error && typeof error === "object" && "stack" in error) {
    stack = String(error.stack);
  }

  // Enhance context with error details
  const enhancedContext = {
    ...context,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : String(error),
  };

  // Also log to console for immediate visibility
  const logFn = level === "fatal" ? console.error : level === "warning" ? console.warn : console.error;
  logFn(`[${level.toUpperCase()}] [${source}] ${message}`, {
    error,
    context: enhancedContext,
    endpoint,
    userId,
  });

  try {
    const [result] = await db
      .insert(errorLogs)
      .values({
        level,
        source,
        message,
        stack,
        context: enhancedContext,
        requestId,
        userId,
        endpoint,
        statusCode,
        duration,
      })
      .returning({ id: errorLogs.id });

    return result?.id ?? null;
  } catch (dbError) {
    // If logging to DB fails, at least we logged to console
    console.error("[ErrorLogger] Failed to log to database:", dbError);
    return null;
  }
}

/**
 * Quick helper for logging API errors
 */
export function logApiError(
  endpoint: string,
  error: unknown,
  options?: {
    userId?: string;
    statusCode?: number;
    context?: Record<string, unknown>;
  }
) {
  return logError({
    source: "api",
    message: error instanceof Error ? error.message : "API error occurred",
    error,
    endpoint,
    ...options,
  });
}

/**
 * Quick helper for logging Inngest function errors
 */
export function logInngestError(
  functionName: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  return logError({
    source: "inngest",
    message: error instanceof Error ? error.message : "Inngest function error",
    error,
    endpoint: functionName,
    context,
  });
}

/**
 * Quick helper for logging AI/ML errors
 */
export function logAiError(
  operation: string,
  error: unknown,
  options?: {
    userId?: string;
    context?: Record<string, unknown>;
  }
) {
  return logError({
    source: "ai",
    message: error instanceof Error ? error.message : "AI operation failed",
    error,
    endpoint: operation,
    ...options,
  });
}

/**
 * Quick helper for logging webhook errors
 */
export function logWebhookError(
  webhookUrl: string,
  error: unknown,
  options?: {
    userId?: string;
    statusCode?: number;
    context?: Record<string, unknown>;
  }
) {
  return logError({
    source: "webhook",
    message: error instanceof Error ? error.message : "Webhook delivery failed",
    error,
    endpoint: webhookUrl,
    ...options,
  });
}

/**
 * Log a warning (non-critical issue)
 */
export function logWarning(
  source: ErrorSource,
  message: string,
  context?: Record<string, unknown>
) {
  return logError({
    level: "warning",
    source,
    message,
    context,
  });
}

/**
 * Log a fatal error (system-critical)
 */
export function logFatal(
  source: ErrorSource,
  message: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  return logError({
    level: "fatal",
    source,
    message,
    error,
    context,
  });
}
