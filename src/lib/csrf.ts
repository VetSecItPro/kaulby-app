/**
 * CSRF Protection — Double-Submit Cookie Pattern (FIX-009)
 *
 * How it works:
 * 1. Middleware sets a `kaulby_csrf` cookie on authenticated responses (if not already present).
 * 2. Client-side code reads the cookie value via `getCsrfToken()` and sends it as the
 *    `X-CSRF-Token` header on state-changing requests (POST/PUT/PATCH/DELETE).
 * 3. API route handlers call `verifyCsrfToken(request)` to compare the header against the cookie.
 *
 * Note: Next.js server actions already have built-in CSRF protection via Origin header checking,
 * so this is primarily for API routes that handle critical state changes (account deletion,
 * role changes, etc.).
 */

import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "kaulby_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generates a CSRF token and sets it as a cookie on the response.
 * Call this in middleware for authenticated routes.
 */
export function setCsrfCookie(response: NextResponse): NextResponse {
  const token = crypto.randomUUID();
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by client-side JS for double-submit pattern
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    // No maxAge — session cookie that expires when browser closes
  });
  return response;
}

/**
 * Checks whether the request already has a CSRF cookie set.
 */
export function hasCsrfCookie(request: NextRequest): boolean {
  return !!request.cookies.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Verifies the CSRF token by comparing the cookie value against the X-CSRF-Token header.
 * Returns true if they match, false otherwise.
 *
 * Usage in API routes:
 * ```ts
 * import { verifyCsrfToken } from "@/lib/csrf";
 *
 * export async function POST(request: NextRequest) {
 *   if (!verifyCsrfToken(request)) {
 *     return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
 *   }
 *   // ... handle request
 * }
 * ```
 */
export function verifyCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    mismatch |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Client-side helper to read the CSRF token from the cookie.
 * Use this to set the X-CSRF-Token header on fetch requests.
 *
 * Usage:
 * ```ts
 * import { getCsrfToken } from "@/lib/csrf";
 *
 * fetch("/api/some-endpoint", {
 *   method: "POST",
 *   headers: {
 *     "X-CSRF-Token": getCsrfToken() ?? "",
 *     "Content-Type": "application/json",
 *   },
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));

  return match ? match.split("=")[1] : null;
}

/** Exported for tests / consumers that need the constant */
export const CSRF_COOKIE = CSRF_COOKIE_NAME;
export const CSRF_HEADER = CSRF_HEADER_NAME;
