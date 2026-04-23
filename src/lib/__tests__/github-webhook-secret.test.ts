import { describe, it, expect } from "vitest";
import {
  generateGitHubWebhookSecret,
  looksLikeGitHubWebhookSecret,
} from "../github-webhook-secret";

describe("generateGitHubWebhookSecret", () => {
  it("returns a 64-char hex string (32 bytes)", () => {
    const secret = generateGitHubWebhookSecret();
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    expect(secret.length).toBe(64);
  });

  it("produces a different value on each call", () => {
    const a = generateGitHubWebhookSecret();
    const b = generateGitHubWebhookSecret();
    expect(a).not.toBe(b);
  });

  it("generates high-entropy output (no obvious patterns)", () => {
    // Not a rigorous randomness test — just a smoke check that we're using
    // crypto.randomBytes, not Date.now() or similar low-entropy source.
    const samples = Array.from({ length: 100 }, () => generateGitHubWebhookSecret());
    const unique = new Set(samples);
    expect(unique.size).toBe(100);
  });
});

describe("looksLikeGitHubWebhookSecret", () => {
  it("accepts a freshly-generated secret", () => {
    const secret = generateGitHubWebhookSecret();
    expect(looksLikeGitHubWebhookSecret(secret)).toBe(true);
  });

  it("accepts mixed-case hex", () => {
    expect(looksLikeGitHubWebhookSecret("A1B2C3D4E5F607080910111213141516" + "1718191A1B1C1D1E1F202122232425" + "26")).toBe(true);
  });

  it("rejects strings shorter than 64 chars", () => {
    expect(looksLikeGitHubWebhookSecret("a".repeat(63))).toBe(false);
  });

  it("rejects strings longer than 64 chars", () => {
    expect(looksLikeGitHubWebhookSecret("a".repeat(65))).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(looksLikeGitHubWebhookSecret("g".repeat(64))).toBe(false);
    expect(looksLikeGitHubWebhookSecret("aaaa-aaaa-" + "a".repeat(54))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(looksLikeGitHubWebhookSecret("")).toBe(false);
  });
});
