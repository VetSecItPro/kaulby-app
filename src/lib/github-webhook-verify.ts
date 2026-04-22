/**
 * GitHub webhook signature verification.
 *
 * GitHub signs every webhook delivery with HMAC-SHA256 over the raw body.
 * The signature arrives in the `X-Hub-Signature-256` request header in the
 * format `sha256=<hex>`. Verification MUST use a constant-time compare to
 * prevent timing attacks.
 *
 * Reference: https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify a GitHub webhook payload against its signature header.
 *
 * @param rawBody - Exact bytes of the request body as received from GitHub
 *                  (do NOT re-serialize the parsed JSON — whitespace changes
 *                  would invalidate the signature).
 * @param signatureHeader - Value of `X-Hub-Signature-256` (expected format:
 *                          `sha256=<hex>`). May be null if the header was missing.
 * @param secret - Shared secret configured on the GitHub webhook (kept in the
 *                 `GITHUB_WEBHOOK_SECRET` env var).
 * @returns `true` iff the signature matches; `false` on any mismatch, missing
 *          header, malformed format, or internal error.
 */
export function verifyGitHubSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;

  try {
    const expectedHex = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const expectedHeader = `sha256=${expectedHex}`;

    const received = Buffer.from(signatureHeader);
    const expected = Buffer.from(expectedHeader);

    // Length check first — timingSafeEqual throws on mismatched lengths and the
    // length itself is not secret, so a direct length check is safe.
    if (received.length !== expected.length) return false;

    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}
