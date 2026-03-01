/**
 * Security Module
 *
 * Centralized security utilities for the Kaulby application.
 * Import from this module for all security-related functions.
 *
 * @example
 * import { escapeHtml, escapeRegExp, sanitizeUrl } from '@/lib/security';
 */

export {
  // HTML sanitization (XSS prevention)
  escapeHtml,
  escapeHtmlPreserveSafe,
  stripHtml,
  // Regex sanitization (ReDoS prevention)
  escapeRegExp,
  isSafeRegexPattern,
  createSafeRegExp,
  // Log sanitization (Log injection prevention)
  sanitizeForLog,
  safeLog,
  // URL sanitization
  sanitizeUrl,
  // Input validation
  isValidEmail,
  isValidUuid,
  truncate,
  // Monitor input sanitization
  sanitizeMonitorInput,
  isValidKeyword,
} from "./sanitize";

// HMAC signing for email tracking URLs (RT-001 open redirect fix)
export { signTrackingParams, verifyTrackingSignature } from "./hmac";
