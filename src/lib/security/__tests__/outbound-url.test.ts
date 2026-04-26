import { describe, it, expect } from "vitest";
import { validateOutboundUrl } from "../outbound-url";

/**
 * Regression tests for SEC-SSRF-001 / SEC-SSRF-002.
 * Block class: any URL that resolves into private/loopback/link-local IP space,
 * cloud metadata, CGNAT, or has userinfo embedded.
 */
describe("validateOutboundUrl — SSRF block list", () => {
  const allowed = [
    "https://example.com/webhook",
    "https://api.kaulbyapp.com/v1/notify",
    "http://203.0.113.10/test", // TEST-NET-3 — public, even if reserved for docs
    "https://webhooks.example.com/path/with/segments",
  ];

  for (const url of allowed) {
    it(`allows public URL: ${url}`, () => {
      expect(validateOutboundUrl(url).ok).toBe(true);
    });
  }

  const blocked = [
    // Loopback / unspecified
    ["http://localhost/x", "localhost"],
    ["https://127.0.0.1/x", "loopback IPv4"],
    ["http://0.0.0.0/x", "unspecified IPv4"],
    ["http://[::1]/x", "loopback IPv6"],
    ["http://[::]/x", "unspecified IPv6"],
    // Private IPv4
    ["http://10.0.0.1/x", "10.0.0.0/8"],
    ["http://10.255.255.255/x", "10.0.0.0/8 boundary"],
    ["http://172.16.0.1/x", "172.16.0.0/12 lower"],
    ["http://172.31.255.255/x", "172.16.0.0/12 upper"],
    ["http://192.168.1.1/x", "192.168.0.0/16"],
    // Cloud metadata / link-local
    ["http://169.254.169.254/latest/meta-data/", "AWS metadata"],
    ["http://169.254.1.1/x", "link-local IPv4"],
    ["http://metadata.google.internal/x", "GCP metadata"],
    ["http://metadata/x", "bare metadata"],
    // CGNAT
    ["http://100.64.0.1/x", "CGNAT lower"],
    ["http://100.127.255.255/x", "CGNAT upper"],
    // IPv4-mapped IPv6 sneaking past
    ["http://[::ffff:127.0.0.1]/x", "IPv4-mapped loopback"],
    ["http://[::ffff:10.0.0.1]/x", "IPv4-mapped private"],
    // Link-local + ULA IPv6
    ["http://[fe80::1]/x", "fe80::/10"],
    ["http://[fc00::1]/x", "fc00::/7 ULA"],
    ["http://[fd12:3456::1]/x", "fd00::/8 ULA"],
    // .local / .localhost suffix
    ["http://service.local/x", ".local mDNS"],
    ["http://app.localhost/x", ".localhost suffix"],
    // Userinfo
    ["http://user:pass@example.com/x", "userinfo (auth-injection vector)"],
    // Wrong protocols
    ["javascript:alert(1)", "javascript:"],
    ["data:text/html,<script>alert(1)</script>", "data:"],
    ["file:///etc/passwd", "file:"],
    ["ftp://example.com/x", "ftp:"],
    // Garbage
    ["", "empty string"],
    ["not-a-url", "unparseable"],
  ];

  for (const [url, label] of blocked) {
    it(`blocks ${label}: ${url}`, () => {
      const result = validateOutboundUrl(url);
      expect(result.ok, `expected ${url} to be blocked but was ${JSON.stringify(result)}`).toBe(false);
      expect(result.reason).toBeTruthy();
    });
  }

  it("rejects null/undefined safely", () => {
    expect(validateOutboundUrl(null).ok).toBe(false);
    expect(validateOutboundUrl(undefined).ok).toBe(false);
  });
});
