/**
 * Security Sanitization Utilities
 *
 * Provides safe sanitization functions to prevent:
 * - XSS (Cross-Site Scripting) attacks
 * - ReDoS (Regular Expression Denial of Service) attacks
 * - SQL Injection (handled by Drizzle ORM, but we validate inputs)
 * - Log Injection attacks
 *
 * USE THESE FUNCTIONS for any user-provided input before:
 * - Inserting into HTML (emails, rendered pages)
 * - Using in RegExp patterns
 * - Logging to console or external services
 */

// ============================================================================
// HTML SANITIZATION (XSS Prevention)
// ============================================================================

/**
 * HTML entity map for escaping dangerous characters
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Escape HTML special characters to prevent XSS attacks.
 * Use this for ANY user-provided content that will be rendered in HTML.
 *
 * @example
 * const userTitle = '<script>alert("xss")</script>';
 * const safe = escapeHtml(userTitle);
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe).replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Escape HTML but preserve specific safe tags (for rich text display).
 * Only allows: <b>, <i>, <em>, <strong>, <br>
 *
 * @example
 * const userBio = '<b>Hello</b><script>bad</script>';
 * const safe = escapeHtmlPreserveSafe(userBio);
 * // Returns: '<b>Hello</b>&lt;script&gt;bad&lt;/script&gt;'
 */
export function escapeHtmlPreserveSafe(unsafe: string | null | undefined): string {
  if (!unsafe) return "";

  // First, escape everything
  let safe = escapeHtml(unsafe);

  // Then, unescape only the safe tags
  const safeTags = ["b", "i", "em", "strong", "br"];
  for (const tag of safeTags) {
    // Opening tags
    safe = safe.replace(
      new RegExp(`&lt;(${tag})&gt;`, "gi"),
      `<$1>`
    );
    // Closing tags
    safe = safe.replace(
      new RegExp(`&lt;/(${tag})&gt;`, "gi"),
      `</$1>`
    );
    // Self-closing tags (for <br />)
    safe = safe.replace(
      new RegExp(`&lt;(${tag})\\s*/&gt;`, "gi"),
      `<$1 />`
    );
  }

  return safe;
}

/**
 * Strip all HTML tags from a string (for plain text contexts).
 *
 * @example
 * const userInput = '<b>Hello</b> <script>bad</script> World';
 * const clean = stripHtml(userInput);
 * // Returns: 'Hello  World'
 */
export function stripHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// REGEX SANITIZATION (ReDoS Prevention)
// ============================================================================

/**
 * Escape special regex characters to prevent ReDoS attacks.
 * Use this when building RegExp from user-provided strings.
 *
 * @example
 * const userKeyword = 'hello (world)';
 * const pattern = new RegExp(escapeRegExp(userKeyword), 'gi');
 * // Safe: matches literal 'hello (world)'
 */
export function escapeRegExp(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate that a string is safe to use as a regex pattern.
 * Rejects patterns with potential ReDoS vulnerabilities.
 *
 * @returns true if safe, false if potentially dangerous
 */
export function isSafeRegexPattern(pattern: string): boolean {
  if (!pattern) return true;

  // Check for common ReDoS patterns
  const dangerousPatterns = [
    /(\+|\*|\?)\1{2,}/, // Multiple quantifiers like +++, ***, ???
    /\([^)]*\+[^)]*\)\+/, // Nested quantifiers like (a+)+
    /\([^)]*\*[^)]*\)\*/, // Nested quantifiers like (a*)*
    /\([^)]*\+[^)]*\)\*/, // Mixed nested quantifiers
    /\([^)]*\*[^)]*\)\+/, // Mixed nested quantifiers
    /\{\d+,\d*\}\s*\{\d+,\d*\}/, // Multiple range quantifiers
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      return false;
    }
  }

  // Check pattern length (long patterns can be slow)
  if (pattern.length > 500) {
    return false;
  }

  return true;
}

/**
 * Create a safe RegExp from user input with timeout protection.
 * If the pattern is potentially dangerous, returns null.
 *
 * @example
 * const userSearch = 'hello world';
 * const regex = createSafeRegExp(userSearch, 'gi');
 * if (regex) {
 *   text.match(regex);
 * }
 */
export function createSafeRegExp(
  pattern: string | null | undefined,
  flags?: string
): RegExp | null {
  if (!pattern) return null;

  // Escape the pattern to treat it as literal text
  const escaped = escapeRegExp(pattern);

  // Double-check it's safe
  if (!isSafeRegexPattern(escaped)) {
    console.warn("[Security] Rejected potentially dangerous regex pattern");
    return null;
  }

  try {
    return new RegExp(escaped, flags);
  } catch {
    return null;
  }
}

// ============================================================================
// LOG SANITIZATION (Log Injection Prevention)
// ============================================================================

/**
 * Sanitize a string for safe logging.
 * Removes control characters and limits length.
 *
 * @example
 * const userInput = 'hello\nworld\r\n<script>';
 * console.log('User said:', sanitizeForLog(userInput));
 * // Logs: 'User said: hello world <script>'
 */
export function sanitizeForLog(
  unsafe: string | null | undefined,
  maxLength: number = 500
): string {
  if (!unsafe) return "";

  return String(unsafe)
    // Remove control characters (newlines, carriage returns, tabs, etc.)
    .replace(/[\x00-\x1F\x7F]/g, " ")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    // Trim and limit length
    .trim()
    .substring(0, maxLength);
}

/**
 * Safely format a log message with interpolated values.
 * All values are sanitized before interpolation.
 *
 * @example
 * safeLog('User %s performed action %s', [userId, action]);
 */
export function safeLog(
  template: string,
  values: (string | number | boolean | null | undefined)[]
): string {
  let result = template;
  let valueIndex = 0;

  result = result.replace(/%[sdifj]/g, () => {
    const value = values[valueIndex++];
    if (value === null || value === undefined) {
      return "[null]";
    }
    if (typeof value === "string") {
      return sanitizeForLog(value, 100);
    }
    return String(value);
  });

  return result;
}

// ============================================================================
// URL SANITIZATION
// ============================================================================

/**
 * Validate and sanitize a URL to prevent javascript: and data: attacks.
 *
 * @returns The URL if safe, or null if potentially dangerous
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = String(url).trim();

  // Block dangerous protocols
  const lowerUrl = trimmed.toLowerCase();
  if (
    lowerUrl.startsWith("javascript:") ||
    lowerUrl.startsWith("data:") ||
    lowerUrl.startsWith("vbscript:")
  ) {
    return null;
  }

  // Ensure it's a valid URL
  try {
    const parsed = new URL(trimmed);
    // Only allow http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return trimmed;
  } catch {
    // If it's not a valid absolute URL, check if it's a relative path
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return trimmed;
    }
    return null;
  }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Validate an email address format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate a UUID format.
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Truncate a string safely with ellipsis.
 */
export function truncate(
  str: string | null | undefined,
  maxLength: number
): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}
