import { describe, it, expect, beforeEach, vi } from "vitest";

// Ensure no Redis env vars so we use the in-memory fallback
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

// Mock the @upstash modules to prevent any connection attempts
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

// Use dynamic import after mocks are set up
async function loadModule() {
  return import("../rate-limit");
}

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe("checkApiRateLimit (in-memory fallback)", () => {
    it("allows requests under the read limit (60/min)", async () => {
      const { checkApiRateLimit } = await loadModule();
      const result = await checkApiRateLimit("user-read-1", "read");
      expect(result.allowed).toBe(true);
    });

    it("allows requests under the write limit (20/min)", async () => {
      const { checkApiRateLimit } = await loadModule();
      const result = await checkApiRateLimit("user-write-1", "write");
      expect(result.allowed).toBe(true);
    });

    it("allows requests under the export limit (5/min)", async () => {
      const { checkApiRateLimit } = await loadModule();
      const result = await checkApiRateLimit("user-export-1", "export");
      expect(result.allowed).toBe(true);
    });

    it("blocks after exceeding the write limit of 20", async () => {
      const { checkApiRateLimit } = await loadModule();
      const userId = "user-write-exceed";

      // Use up all 20 write requests
      for (let i = 0; i < 20; i++) {
        const r = await checkApiRateLimit(userId, "write");
        expect(r.allowed).toBe(true);
      }

      // 21st should be blocked
      const blocked = await checkApiRateLimit(userId, "write");
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it("blocks after exceeding the export limit of 5", async () => {
      const { checkApiRateLimit } = await loadModule();
      const userId = "user-export-exceed";

      for (let i = 0; i < 5; i++) {
        const r = await checkApiRateLimit(userId, "export");
        expect(r.allowed).toBe(true);
      }

      const blocked = await checkApiRateLimit(userId, "export");
      expect(blocked.allowed).toBe(false);
    });

    it("resets after the time window elapses", async () => {
      const { checkApiRateLimit } = await loadModule();
      const userId = "user-reset-test";

      // Exhaust write limit
      for (let i = 0; i < 20; i++) {
        await checkApiRateLimit(userId, "write");
      }
      const blocked = await checkApiRateLimit(userId, "write");
      expect(blocked.allowed).toBe(false);

      // Advance time past the 1-minute window
      vi.advanceTimersByTime(61_000);

      const afterReset = await checkApiRateLimit(userId, "write");
      expect(afterReset.allowed).toBe(true);
    });

    it("tracks different users independently", async () => {
      const { checkApiRateLimit } = await loadModule();

      // Exhaust write limit for user A
      for (let i = 0; i < 20; i++) {
        await checkApiRateLimit("user-A-indep", "write");
      }
      const blockedA = await checkApiRateLimit("user-A-indep", "write");
      expect(blockedA.allowed).toBe(false);

      // User B should still be allowed
      const allowedB = await checkApiRateLimit("user-B-indep", "write");
      expect(allowedB.allowed).toBe(true);
    });

    it("tracks different operation types independently", async () => {
      const { checkApiRateLimit } = await loadModule();
      const userId = "user-type-indep";

      // Exhaust write limit
      for (let i = 0; i < 20; i++) {
        await checkApiRateLimit(userId, "write");
      }
      const blockedWrite = await checkApiRateLimit(userId, "write");
      expect(blockedWrite.allowed).toBe(false);

      // Read should still work for the same user
      const allowedRead = await checkApiRateLimit(userId, "read");
      expect(allowedRead.allowed).toBe(true);
    });
  });

  describe("checkBodySize", () => {
    it("allows requests within the default size limit", async () => {
      const { checkBodySize } = await loadModule();
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "1000" },
      });
      const result = checkBodySize(request);
      expect(result.ok).toBe(true);
      expect(result.size).toBe(1000);
    });

    it("rejects requests exceeding the default limit (100KB)", async () => {
      const { checkBodySize } = await loadModule();
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "200000" },
      });
      const result = checkBodySize(request);
      expect(result.ok).toBe(false);
      expect(result.size).toBe(200000);
    });

    it("allows requests with custom size limit", async () => {
      const { checkBodySize } = await loadModule();
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "500" },
      });
      const result = checkBodySize(request, 1000);
      expect(result.ok).toBe(true);
    });

    it("allows requests with no content-length header", async () => {
      const { checkBodySize } = await loadModule();
      const request = new Request("http://localhost", { method: "POST" });
      const result = checkBodySize(request);
      expect(result.ok).toBe(true);
      expect(result.size).toBe(0);
    });
  });

  describe("parseJsonBody", () => {
    it("parses valid JSON within size limit", async () => {
      const { parseJsonBody } = await loadModule();
      const body = JSON.stringify({ name: "test" });
      const request = new Request("http://localhost", {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "content-length": String(body.length),
        },
      });
      const parsed = await parseJsonBody(request);
      expect(parsed).toEqual({ name: "test" });
    });

    it("throws BodyTooLargeError when content-length exceeds limit", async () => {
      const { parseJsonBody, BodyTooLargeError } = await loadModule();
      const request = new Request("http://localhost", {
        method: "POST",
        body: "{}",
        headers: { "content-length": "200000" },
      });
      await expect(parseJsonBody(request)).rejects.toThrow(BodyTooLargeError);
    });

    it("throws InvalidJsonError for invalid JSON", async () => {
      const { parseJsonBody, InvalidJsonError } = await loadModule();
      const request = new Request("http://localhost", {
        method: "POST",
        body: "not-json{{{",
        headers: { "content-length": "11" },
      });
      await expect(parseJsonBody(request)).rejects.toThrow(InvalidJsonError);
    });
  });
});
