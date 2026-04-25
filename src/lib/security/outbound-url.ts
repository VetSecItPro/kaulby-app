/**
 * Outbound URL validation for SSRF prevention.
 *
 * Use this before any server-side fetch() that uses a user-provided URL
 * (webhook test, webhook delivery target, external image proxy, etc).
 *
 * Why this exists separately from sanitizeUrl():
 * - sanitizeUrl() blocks dangerous protocols (javascript:, data:, vbscript:)
 *   but does NOT block private/internal network targets.
 * - SSRF requires blocking the IP space, not just the protocol. A user can
 *   pass http://169.254.169.254/ (AWS metadata service) or http://10.0.0.1/
 *   (internal network) past sanitizeUrl().
 *
 * Defenses applied here:
 * 1. Reject non-http(s) protocols
 * 2. Reject hostnames that resolve to private/loopback/link-local IP space
 * 3. Reject explicit private IPs in the hostname (IPv4 + IPv6 + IPv4-mapped IPv6)
 * 4. Reject AWS/GCP/Azure metadata endpoints
 * 5. Reject CGNAT range (100.64.0.0/10)
 * 6. Reject userinfo (http://user:pass@evil.com — auth-injection vector)
 *
 * Note: hostname-only check does NOT prevent DNS rebinding (where a hostname
 * resolves to a public IP at validation time but a private IP at fetch time).
 * For high-trust paths, also restrict the fetch to a vetted resolver and
 * verify the resolved IP is public before connecting. That requires a custom
 * fetch agent and is out of scope for this helper.
 */

const PRIVATE_IPV4_RANGES: Array<[bigint, bigint]> = [
  // 10.0.0.0/8
  [ip4ToBig("10.0.0.0"), ip4ToBig("10.255.255.255")],
  // 172.16.0.0/12
  [ip4ToBig("172.16.0.0"), ip4ToBig("172.31.255.255")],
  // 192.168.0.0/16
  [ip4ToBig("192.168.0.0"), ip4ToBig("192.168.255.255")],
  // 127.0.0.0/8 (loopback)
  [ip4ToBig("127.0.0.0"), ip4ToBig("127.255.255.255")],
  // 169.254.0.0/16 (link-local + cloud metadata)
  [ip4ToBig("169.254.0.0"), ip4ToBig("169.254.255.255")],
  // 100.64.0.0/10 (CGNAT)
  [ip4ToBig("100.64.0.0"), ip4ToBig("100.127.255.255")],
  // 0.0.0.0/8 (current network — sometimes routes to localhost)
  [ip4ToBig("0.0.0.0"), ip4ToBig("0.255.255.255")],
];

function ip4ToBig(ip: string): bigint {
  return ip.split(".").reduce(
    (acc, octet) => (acc << BigInt(8)) | BigInt(Number(octet)),
    BigInt(0),
  );
}

function isIpv4Private(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((n) => n < 0 || n > 255)) return true; // invalid → reject
  const big = ip4ToBig(host);
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => big >= lo && big <= hi);
}

function isIpv6Private(host: string): boolean {
  const inner = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const lower = inner.toLowerCase();
  // Loopback
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  // Unspecified
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
  // Link-local fe80::/10
  if (lower.startsWith("fe80:") || /^fe[89ab]/.test(lower)) return true;
  // Unique local fc00::/7
  if (/^f[cd]/.test(lower)) return true;
  // IPv4-mapped, dotted form (::ffff:10.0.0.1)
  const mappedDotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedDotted) return isIpv4Private(mappedDotted[1]);
  // IPv4-mapped, compressed hex form Node.js URL parser produces
  // (::ffff:7f00:1 for 127.0.0.1, ::ffff:a00:1 for 10.0.0.1)
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1].padStart(4, "0"), 16);
    const low = parseInt(mappedHex[2].padStart(4, "0"), 16);
    const a = (high >> 8) & 0xff;
    const b = high & 0xff;
    const c = (low >> 8) & 0xff;
    const d = low & 0xff;
    return isIpv4Private(`${a}.${b}.${c}.${d}`);
  }
  return false;
}

function isLocalHostname(host: string): boolean {
  const lower = host.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower === "metadata.google.internal" ||
    lower === "metadata"
  );
}

export interface OutboundUrlValidationResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

export function validateOutboundUrl(input: string | null | undefined): OutboundUrlValidationResult {
  if (!input) return { ok: false, reason: "URL is empty" };

  const trimmed = String(input).trim();
  if (!trimmed) return { ok: false, reason: "URL is empty" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "URL is not parseable" };
  }

  // Protocol allowlist
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `Protocol ${parsed.protocol} not allowed (only http/https)` };
  }

  // No userinfo (http://user:pass@evil.com)
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URL must not contain userinfo (user:pass@)" };
  }

  // Hostname checks
  const host = parsed.hostname;
  if (!host) return { ok: false, reason: "URL has no host" };

  if (isLocalHostname(host)) {
    return { ok: false, reason: `Hostname ${host} is local` };
  }
  if (isIpv4Private(host)) {
    return { ok: false, reason: `Hostname ${host} is in private IPv4 range` };
  }
  if (isIpv6Private(host)) {
    return { ok: false, reason: `Hostname ${host} is in private IPv6 range` };
  }

  return { ok: true, url: trimmed };
}
