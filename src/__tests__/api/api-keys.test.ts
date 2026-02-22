import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockFindUserWithFallback,
  mockListApiKeys,
  mockCreateApiKey,
  mockRevokeApiKey,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockFindUserWithFallback: vi.fn(),
    mockListApiKeys: vi.fn(),
    mockCreateApiKey: vi.fn(),
    mockRevokeApiKey: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));

vi.mock("@/lib/auth-utils", () => ({
  findUserWithFallback: (...args: unknown[]) => mockFindUserWithFallback(...args),
}));

vi.mock("@/lib/api-auth", () => ({
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  createApiKey: (...args: unknown[]) => mockCreateApiKey(...args),
  revokeApiKey: (...args: unknown[]) => mockRevokeApiKey(...args),
}));

vi.mock("@/lib/error-logger", () => ({
  logError: vi.fn(),
}));

// --- Imports ---
import { GET, POST, DELETE } from "@/app/api/api-keys/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(`http://localhost${url}`, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

// ==========================================
// GET /api/api-keys
// ==========================================
describe("GET /api/api-keys", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("returns 403 when user is not on Team plan", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({ id: "user_1", subscriptionStatus: "pro" });
    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Team plan");
  });

  it("returns 403 when user not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns keys for enterprise user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({ id: "user_1", subscriptionStatus: "enterprise" });
    const mockKeys = [
      { id: "key_1", name: "Production", keyPrefix: "kby_prod", createdAt: "2024-01-01" },
    ];
    mockListApiKeys.mockResolvedValue(mockKeys);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keys).toHaveLength(1);
    expect(json.keys[0].id).toBe("key_1");
  });
});

// ==========================================
// POST /api/api-keys
// ==========================================
describe("POST /api/api-keys", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/api-keys", { name: "Test Key" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    const res = await POST(makeRequest("POST", "/api/api-keys", { name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Name is required");
  });

  it("returns 403 when user is not enterprise", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({ id: "user_1", subscriptionStatus: "pro" });
    const res = await POST(makeRequest("POST", "/api/api-keys", { name: "Test Key" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Team plan");
  });

  it("returns 403 when createApiKey returns null (limit reached)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({ id: "user_1", subscriptionStatus: "enterprise" });
    mockCreateApiKey.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", "/api/api-keys", { name: "Test Key" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("limit");
  });

  it("creates API key successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({ id: "user_1", subscriptionStatus: "enterprise" });
    mockCreateApiKey.mockResolvedValue({
      id: "key_1",
      key: "kby_live_abc123",
      prefix: "kby_live_abc",
    });
    const res = await POST(makeRequest("POST", "/api/api-keys", { name: "Production" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.key).toBe("kby_live_abc123");
    expect(json.keyInfo).toBeDefined();
    expect(json.keyInfo.name).toBe("Production");
  });
});

// ==========================================
// DELETE /api/api-keys
// ==========================================
describe("DELETE /api/api-keys", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest("DELETE", "/api/api-keys?keyId=key_1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when keyId is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    const res = await DELETE(makeRequest("DELETE", "/api/api-keys"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Key ID is required");
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE", "/api/api-keys?keyId=key_1"));
    expect(res.status).toBe(404);
  });

  it("revokes API key successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({ id: "user_1", subscriptionStatus: "enterprise" });
    mockRevokeApiKey.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest("DELETE", "/api/api-keys?keyId=key_1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockRevokeApiKey).toHaveBeenCalledWith("key_1", "user_1");
  });
});
