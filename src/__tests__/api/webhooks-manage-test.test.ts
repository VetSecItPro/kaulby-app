import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockFetch,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { webhooks: { findFirst: vi.fn() } },
    mockFetch: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery },
}));

vi.mock("@/lib/db/schema", () => ({
  webhooks: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// Mock global fetch
vi.stubGlobal("fetch", mockFetch);

// --- Imports ---
import { POST } from "@/app/api/webhooks/manage/test/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/manage/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve("OK"),
  } as never);
});

// ==========================================
// POST /api/webhooks/manage/test
// ==========================================
describe("POST /api/webhooks/manage/test", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 400 when webhook ID missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Webhook ID is required");
  });

  it("returns 404 when webhook not found", async () => {
    mockDbQuery.webhooks.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ id: "wh_nonexistent" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Webhook not found");
  });

  it("returns 404 when webhook belongs to different user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_2" });
    // The and() filter in the route means findFirst returns null for different user
    mockDbQuery.webhooks.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Webhook not found");
  });

  it("successfully sends test webhook and returns success with latencyMs", async () => {
    mockDbQuery.webhooks.findFirst.mockResolvedValue({
      id: "wh_1",
      userId: "user_1",
      name: "Test Webhook",
      url: "https://example.com/webhook",
      secret: null,
      headers: null,
    });

    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.statusCode).toBe(200);
    expect(json.latencyMs).toBeGreaterThanOrEqual(0);
    expect(json.error).toBeNull();
    expect(json.responseBody).toBe("OK");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Webhook-Event": "test",
        }),
      })
    );
  });

  it("includes HMAC signature header when webhook has secret", async () => {
    mockDbQuery.webhooks.findFirst.mockResolvedValue({
      id: "wh_1",
      userId: "user_1",
      name: "Test Webhook",
      url: "https://example.com/webhook",
      secret: "test_secret_key",
      headers: null,
    });

    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(200);

    const fetchCall = mockFetch.mock.calls[0];
    const headers = fetchCall[1]?.headers as Record<string, string>;
    expect(headers["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("includes custom headers from webhook configuration", async () => {
    mockDbQuery.webhooks.findFirst.mockResolvedValue({
      id: "wh_1",
      userId: "user_1",
      name: "Test Webhook",
      url: "https://example.com/webhook",
      secret: null,
      headers: { "X-Custom-Header": "custom-value", Authorization: "Bearer token123" },
    });

    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(200);

    const fetchCall = mockFetch.mock.calls[0];
    const headers = fetchCall[1]?.headers as Record<string, string>;
    expect(headers["X-Custom-Header"]).toBe("custom-value");
    expect(headers["Authorization"]).toBe("Bearer token123");
  });

  it("handles fetch failure (network error) gracefully", async () => {
    mockDbQuery.webhooks.findFirst.mockResolvedValue({
      id: "wh_1",
      userId: "user_1",
      name: "Test Webhook",
      url: "https://example.com/webhook",
      secret: null,
      headers: null,
    });
    mockFetch.mockRejectedValue(new Error("Network error: ECONNREFUSED"));

    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Network error: ECONNREFUSED");
    expect(json.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("handles non-ok response from webhook endpoint", async () => {
    mockDbQuery.webhooks.findFirst.mockResolvedValue({
      id: "wh_1",
      userId: "user_1",
      name: "Test Webhook",
      url: "https://example.com/webhook",
      secret: null,
      headers: null,
    });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    } as never);

    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.statusCode).toBe(500);
    expect(json.responseBody).toBe("Internal Server Error");
  });

  it("truncates long response bodies to 500 characters", async () => {
    const longResponse = "A".repeat(1000);
    mockDbQuery.webhooks.findFirst.mockResolvedValue({
      id: "wh_1",
      userId: "user_1",
      name: "Test Webhook",
      url: "https://example.com/webhook",
      secret: null,
      headers: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(longResponse),
    } as never);

    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.responseBody).toHaveLength(500);
    expect(json.responseBody).toBe("A".repeat(500));
  });

  it("includes proper test payload structure", async () => {
    mockDbQuery.webhooks.findFirst.mockResolvedValue({
      id: "wh_1",
      userId: "user_1",
      name: "Production Webhook",
      url: "https://example.com/webhook",
      secret: null,
      headers: null,
    });

    await POST(makeRequest({ id: "wh_1" }));

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.eventType).toBe("test");
    expect(body.data.message).toBe("This is a test webhook from Kaulby");
    expect(body.data.webhookId).toBe("wh_1");
    expect(body.data.webhookName).toBe("Production Webhook");
    expect(body.timestamp).toBeDefined();
  });

  it("returns 500 on unexpected error", async () => {
    mockDbQuery.webhooks.findFirst.mockRejectedValue(new Error("Database error"));
    const res = await POST(makeRequest({ id: "wh_1" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to test webhook");
  });
});
