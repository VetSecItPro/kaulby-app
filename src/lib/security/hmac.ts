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
  const secret = process.env.CLERK_SECRET_KEY ?? process.env.RESEND_API_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("HMAC signing requires CLERK_SECRET_KEY or RESEND_API_KEY");
    }
    // Dev fallback only
    return "kaulby-hmac-fallback-key";
  }
  return secret;
}

/**
 * Generate an HMAC-SHA256 signature for a tracking URL's parameters.
 * Signs: eid + uid + type + url (the core redirect parameters).
 */
// SEC-ORT-001: 128-bit HMAC signature (was 64-bit) for collision resistance.
// 32 hex chars = 128 bits, matching industry standard for URL signing.
const SIGNATURE_LENGTH = 32;

// SEC-ORT-001: accept both 64-bit (legacy) and 128-bit signatures during migration.
// Already-sent emails have 16-char sigs; remove legacy acceptance after 2026-05-24
// (30 days post-deploy).
const LEGACY_SIGNATURE_LENGTH = 16;
const VALID_SIG_LENGTHS: readonly number[] = [LEGACY_SIGNATURE_LENGTH, SIGNATURE_LENGTH];

function computeSignatureHex(params: {
  eid: string;
  uid: string;
  type: string;
  url: string;
}): string {
  const payload = `${params.eid}|${params.uid}|${params.type}|${params.url}`;
  return createHmac("sha256", getSigningKey()).update(payload).digest("hex");
}

export function signTrackingParams(params: {
  eid: string;
  uid: string;
  type: string;
  url: string;
}): string {
  // Always sign new URLs at full 128-bit length.
  return computeSignatureHex(params).slice(0, SIGNATURE_LENGTH);
}

/**
 * Verify an HMAC signature on a tracking URL.
 * Returns true only if the signature matches the expected value.
 */
export function verifyTrackingSignature(
  params: { eid: string; uid: string; type: string; url: string },
  signature: string
): boolean {
  // Reject signatures of unexpected length before doing any crypto work.
  if (!VALID_SIG_LENGTHS.includes(signature.length)) return false;

  // Compare against an expected sig truncated to the provided length.
  // Safe because computeSignatureHex is deterministic; the prefix of the
  // 128-bit sig IS the 64-bit sig that was originally emitted.
  const expected = computeSignatureHex(params).slice(0, signature.length);

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}
