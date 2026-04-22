import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyGitHubSignature } from "../github-webhook-verify";

const SECRET = "test-secret-do-not-use-in-prod";

function sign(body: string): string {
  const hex = createHmac("sha256", SECRET).update(body).digest("hex");
  return `sha256=${hex}`;
}

describe("verifyGitHubSignature", () => {
  const goodBody = '{"action":"opened","issue":{"id":1}}';

  it("accepts a correctly signed body", () => {
    expect(verifyGitHubSignature(goodBody, sign(goodBody), SECRET)).toBe(true);
  });

  it("rejects a mismatched signature", () => {
    const wrongSig = "sha256=" + "f".repeat(64);
    expect(verifyGitHubSignature(goodBody, wrongSig, SECRET)).toBe(false);
  });

  it("rejects a signature from a different secret", () => {
    const wrongSecret = "different-secret";
    const hex = createHmac("sha256", wrongSecret).update(goodBody).digest("hex");
    expect(verifyGitHubSignature(goodBody, `sha256=${hex}`, SECRET)).toBe(false);
  });

  it("rejects a signature for a different body (tampering)", () => {
    const tamperedBody = goodBody.replace('"id":1', '"id":999');
    expect(verifyGitHubSignature(tamperedBody, sign(goodBody), SECRET)).toBe(false);
  });

  it("rejects an empty signature header", () => {
    expect(verifyGitHubSignature(goodBody, "", SECRET)).toBe(false);
  });

  it("rejects a null signature header", () => {
    expect(verifyGitHubSignature(goodBody, null, SECRET)).toBe(false);
  });

  it("rejects an undefined signature header", () => {
    expect(verifyGitHubSignature(goodBody, undefined, SECRET)).toBe(false);
  });

  it("rejects a signature without the sha256= prefix", () => {
    const hex = createHmac("sha256", SECRET).update(goodBody).digest("hex");
    expect(verifyGitHubSignature(goodBody, hex, SECRET)).toBe(false);
  });

  it("rejects a signature with the wrong prefix (sha1=)", () => {
    const hex = createHmac("sha256", SECRET).update(goodBody).digest("hex");
    expect(verifyGitHubSignature(goodBody, `sha1=${hex}`, SECRET)).toBe(false);
  });

  it("rejects when the secret is empty", () => {
    expect(verifyGitHubSignature(goodBody, sign(goodBody), "")).toBe(false);
  });

  it("rejects a truncated signature (length attack)", () => {
    expect(verifyGitHubSignature(goodBody, "sha256=abc", SECRET)).toBe(false);
  });

  it("accepts a Buffer body matching a string-signed hex", () => {
    const buf = Buffer.from(goodBody);
    expect(verifyGitHubSignature(buf, sign(goodBody), SECRET)).toBe(true);
  });
});
