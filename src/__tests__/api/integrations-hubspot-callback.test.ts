/**
 * Tests for HubSpot OAuth Callback Route
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoisted mocks
const { mockDbQuery, mockDbUpdate, mockExchangeCodeForTokens, mockGetAccountInfo, mockEncryptIntegrationData, mockLogger } = vi.hoisted(() => ({
  mockDbQuery: {
    users: {
      findFirst: vi.fn(),
    },
  },
  mockDbUpdate: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  })),
  mockExchangeCodeForTokens: vi.fn(),
  mockGetAccountInfo: vi.fn(),
  mockEncryptIntegrationData: vi.fn(),
  mockLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Apply mocks
vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    update: () => mockDbUpdate(),
  },
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/integrations/hubspot", () => ({
  exchangeCodeForTokens: mockExchangeCodeForTokens,
  getAccountInfo: mockGetAccountInfo,
}));

vi.mock("@/lib/encryption", () => ({
  encryptIntegrationData: mockEncryptIntegrationData,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

// Import after mocks are set up
import { GET } from "@/app/api/integrations/hubspot/callback/route";

describe("HubSpot OAuth Callback Route", () => {
  const makeCallbackRequest = (params: Record<string, string>) => {
    const url = new URL("http://localhost:3000/api/integrations/hubspot/callback");
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return new NextRequest(url);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with error when HubSpot returns error param", async () => {
    const req = makeCallbackRequest({ error: "access_denied" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Access%20denied%20by%20user");
    expect(mockLogger.error).toHaveBeenCalledWith("HubSpot OAuth error", {
      error: "access_denied",
      errorDescription: null,
    });
  });

  it("redirects with error when HubSpot returns error with error_description", async () => {
    const req = makeCallbackRequest({
      error: "invalid_scope",
      error_description: "The requested scope is invalid",
    });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed%20to%20authorize%20HubSpot");
    expect(mockLogger.error).toHaveBeenCalledWith("HubSpot OAuth error", {
      error: "invalid_scope",
      errorDescription: "The requested scope is invalid",
    });
  });

  it("redirects with generic error for non-access_denied errors", async () => {
    const req = makeCallbackRequest({ error: "server_error" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed%20to%20authorize%20HubSpot");
  });

  it("redirects with error when code is missing", async () => {
    const req = makeCallbackRequest({ state: "user_1:nonce" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Missing+authorization+code");
  });

  it("redirects with error when state is missing", async () => {
    const req = makeCallbackRequest({ code: "test_code" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Missing+authorization+code");
  });

  it("redirects with error when userId extracted from state is empty", async () => {
    const req = makeCallbackRequest({ code: "test_code", state: ":nonce" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Invalid+state+parameter");
  });

  it("redirects with error when user not found in DB", async () => {
    const req = makeCallbackRequest({ code: "test_code", state: "user_1:nonce" });
    mockDbQuery.users.findFirst.mockResolvedValue(null);

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=User+not+found");
    expect(mockDbQuery.users.findFirst).toHaveBeenCalled();
  });

  it("redirects with error on state mismatch", async () => {
    const req = makeCallbackRequest({ code: "test_code", state: "user_1:nonce123" });
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        hubspot: {
          pendingState: "user_1:different_nonce",
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=State+mismatch");
  });

  it("redirects with error when state is expired (>10 minutes)", async () => {
    const expiredDate = new Date(Date.now() - 11 * 60 * 1000); // 11 minutes ago
    const req = makeCallbackRequest({ code: "test_code", state: "user_1:nonce" });
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        hubspot: {
          pendingState: "user_1:nonce",
          stateCreatedAt: expiredDate.toISOString(),
        },
      },
    });

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Authorization+expired");
  });

  it("redirects with error when stateCreatedAt is missing", async () => {
    const req = makeCallbackRequest({ code: "test_code", state: "user_1:nonce" });
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        hubspot: {
          pendingState: "user_1:nonce",
          // No stateCreatedAt
        },
      },
    });

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Authorization+expired");
  });

  it("successfully connects HubSpot on valid callback and gets account info", async () => {
    const validState = "user_1:nonce";
    const req = makeCallbackRequest({
      code: "test_code",
      state: validState,
    });

    const expiresAt = new Date(Date.now() + 3600 * 1000);

    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        hubspot: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresAt,
    });

    mockGetAccountInfo.mockResolvedValue({
      portalId: "12345",
    });

    mockEncryptIntegrationData.mockReturnValue({ encrypted: true } as never);

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("success=HubSpot+connected+successfully");

    expect(mockExchangeCodeForTokens).toHaveBeenCalledWith("test_code");
    expect(mockGetAccountInfo).toHaveBeenCalledWith("tok_test");
    expect(mockEncryptIntegrationData).toHaveBeenCalledWith({
      connected: true,
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresAt: expiresAt.toISOString(),
      portalId: "12345",
      connectedAt: expect.any(String),
    });

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("handles exchangeCodeForTokens throwing an error", async () => {
    const validState = "user_1:nonce";
    const req = makeCallbackRequest({
      code: "test_code",
      state: validState,
    });

    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        hubspot: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockRejectedValue(new Error("Token exchange failed"));

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed+to+connect+HubSpot");

    expect(mockLogger.error).toHaveBeenCalledWith("HubSpot callback error", {
      error: "Token exchange failed",
    });
  });

  it("handles getAccountInfo throwing an error", async () => {
    const validState = "user_1:nonce";
    const req = makeCallbackRequest({
      code: "test_code",
      state: validState,
    });

    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        hubspot: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresAt: new Date(),
    });

    mockGetAccountInfo.mockRejectedValue(new Error("Failed to get account info"));

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed+to+connect+HubSpot");

    expect(mockLogger.error).toHaveBeenCalledWith("HubSpot callback error", {
      error: "Failed to get account info",
    });
  });

  it("handles database update errors", async () => {
    const validState = "user_1:nonce";
    const req = makeCallbackRequest({
      code: "test_code",
      state: validState,
    });

    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        hubspot: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresAt: new Date(),
    });

    mockGetAccountInfo.mockResolvedValue({
      portalId: "12345",
    });

    mockEncryptIntegrationData.mockReturnValue({ encrypted: true } as never);

    mockDbUpdate.mockImplementationOnce(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error("DB error")),
    }));

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed+to+connect+HubSpot");

    expect(mockLogger.error).toHaveBeenCalledWith("HubSpot callback error", {
      error: "DB error",
    });
  });

  it("handles user with no existing integrations", async () => {
    const validState = "user_1:nonce";
    const req = makeCallbackRequest({
      code: "test_code",
      state: validState,
    });

    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: null, // No integrations object yet
    });

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=State+mismatch"); // pendingState will be undefined
  });
});
