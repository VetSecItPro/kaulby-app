/**
 * Structured Logger — FIX-005
 *
 * Lightweight structured logging with automatic PII sanitization.
 * - Development: human-readable console output with timestamps
 * - Production: JSON output for log aggregation (Datadog, Logtail, etc.)
 *
 * @example
 * import { logger } from '@/lib/logger';
 *
 * logger.info('Monitor created', { monitorId: '123', userId: 'abc' });
 * logger.error('Auth failed', { email: 'user@example.com' });
 * // email is automatically redacted: "us***@example.com"
 */

import { sanitizeForLog } from "@/lib/security";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

/**
 * Keys whose string values are automatically redacted in log output.
 */
const SENSITIVE_KEYS = new Set([
  "email",
  "password",
  "token",
  "secret",
  "authorization",
  "api_key",
  "apiKey",
  "accessToken",
  "refreshToken",
  "cookie",
]);

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === "production";

/**
 * Minimum log level. In production, skip debug logs unless explicitly enabled.
 */
const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? (isProduction ? "info" : "debug");

/**
 * Redact a sensitive string value while keeping it partially recognizable.
 * - Emails: keeps first 2 chars + domain → "us***@example.com"
 * - Short strings (≤6): fully masked → "***"
 * - Other strings: keeps first 3 chars → "tok***"
 */
function redact(value: string): string {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    const prefix = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
    return `${prefix}***@${domain}`;
  }
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***`;
}

/**
 * Recursively sanitize a context object:
 * - Redact values of sensitive keys
 * - Sanitize all string values for log injection
 */
function sanitizeContext(ctx: LogContext): LogContext {
  const sanitized: LogContext = {};

  for (const [key, value] of Object.entries(ctx)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = SENSITIVE_KEYS.has(key)
        ? redact(value)
        : sanitizeForLog(value);
      continue;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value as LogContext);
      continue;
    }

    // Numbers, booleans, arrays — pass through as-is
    sanitized[key] = value;
  }

  return sanitized;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const sanitizedMessage = sanitizeForLog(message);
  const sanitizedContext = context ? sanitizeContext(context) : undefined;

  if (isProduction) {
    // JSON output for log aggregation
    const entry: Record<string, unknown> = {
      timestamp,
      level,
      message: sanitizedMessage,
      ...(sanitizedContext && { context: sanitizedContext }),
    };
    // Use stderr for warn/error so stdout stays clean for structured output
    const stream = level === "error" || level === "warn" ? console.error : console.log;
    stream(JSON.stringify(entry));
  } else {
    // Human-readable output for development
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const consoleFn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "debug"
            ? console.debug
            : console.log;

    if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
      consoleFn(prefix, sanitizedMessage, sanitizedContext);
    } else {
      consoleFn(prefix, sanitizedMessage);
    }
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    emit("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    emit("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    emit("error", message, context);
  },
};
