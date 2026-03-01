/**
 * HMAC Signing & Verification for Email Tracking URLs (FIX RT-001)
 *
 * Prevents open redirect abuse on /api/track/click by ensuring
 * only app-generated tracking URLs are accepted.
 *
 * Uses HMAC-SHA256 with a server-side secret to sign the URL parameter.
 * The signature is appended as a `sig` query parameter.
 */

import { createHmac } from "crypto";

/**
 * Signing key derived from CLERK_SECRET_KEY (always available server-side).
 * Falls back to RESEND_API_KEY, then a test-only default.
 */
function getSigningKey(): string {
  return (
    process.env.CLERK_SECRET_KEY ??
    process.env.RESEND_API_KEY ??
    "kaulby-hmac-fallback-key"
  );
}

/**
 * Generate an HMAC-SHA256 signature for a tracking URL's parameters.
 * Signs: eid + uid + type + url (the core redirect parameters).
 */
export function signTrackingParams(params: {
  eid: string;
  uid: string;
  type: string;
  url: string;
}): string {
  const payload = `${params.eid}|${params.uid}|${params.type}|${params.url}`;
  return createHmac("sha256", getSigningKey())
    .update(payload)
    .digest("hex")
    .slice(0, 16); // 16 hex chars (64 bits) — sufficient for URL signing
}

/**
 * Verify an HMAC signature on a tracking URL.
 * Returns true only if the signature matches the expected value.
 */
export function verifyTrackingSignature(
  params: { eid: string; uid: string; type: string; url: string },
  signature: string
): boolean {
  const expected = signTrackingParams(params);

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
