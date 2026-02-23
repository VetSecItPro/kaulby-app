/**
 * Tests for Discord OAuth Callback Route
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoisted mocks
const { mockDbQuery, mockDbUpdate, mockExchangeCodeForTokens, mockEncryptIntegrationData, mockLogger } = vi.hoisted(() => ({
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

vi.mock("@/lib/integrations/discord", () => ({
  exchangeCodeForTokens: mockExchangeCodeForTokens,
}));

vi.mock("@/lib/encryption", () => ({
  encryptIntegrationData: mockEncryptIntegrationData,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

// Import after mocks are set up
import { GET } from "@/app/api/integrations/discord/callback/route";

describe("Discord OAuth Callback Route", () => {
  const makeCallbackRequest = (params: Record<string, string>) => {
    const url = new URL("http://localhost:3000/api/integrations/discord/callback");
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return new NextRequest(url);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with error when Discord returns error param", async () => {
    const req = makeCallbackRequest({ error: "access_denied" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Access%20denied%20by%20user");
    expect(mockLogger.error).toHaveBeenCalledWith("Discord OAuth error", { error: "access_denied" });
  });

  it("redirects with generic error for non-access_denied errors", async () => {
    const req = makeCallbackRequest({ error: "server_error" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed%20to%20authorize%20Discord");
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
        discord: {
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
        discord: {
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
        discord: {
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

  it("successfully connects Discord on valid callback with guild_id param", async () => {
    const validState = "user_1:nonce";
    const req = makeCallbackRequest({
      code: "test_code",
      state: validState,
      guild_id: "guild_from_param",
    });

    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        discord: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresIn: 3600,
      guildId: "guild_from_token",
      guildName: "Test Server",
    });

    mockEncryptIntegrationData.mockReturnValue({ encrypted: true } as never);

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("success=Discord+connected+successfully");

    expect(mockExchangeCodeForTokens).toHaveBeenCalledWith("test_code");
    expect(mockEncryptIntegrationData).toHaveBeenCalledWith({
      connected: true,
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresIn: 3600,
      guildId: "guild_from_param", // Prefer guild_id from query param
      guildName: "Test Server",
      connectedAt: expect.any(String),
    });

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("successfully connects Discord using guildId from token when no guild_id param", async () => {
    const validState = "user_1:nonce";
    const req = makeCallbackRequest({
      code: "test_code",
      state: validState,
    });

    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        discord: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresIn: 3600,
      guildId: "guild_from_token",
      guildName: "Test Server",
    });

    mockEncryptIntegrationData.mockReturnValue({ encrypted: true } as never);

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("success=Discord+connected+successfully");

    expect(mockEncryptIntegrationData).toHaveBeenCalledWith({
      connected: true,
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresIn: 3600,
      guildId: "guild_from_token", // Use guildId from token response
      guildName: "Test Server",
      connectedAt: expect.any(String),
    });
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
        discord: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockRejectedValue(new Error("Token exchange failed"));

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed+to+connect+Discord");

    expect(mockLogger.error).toHaveBeenCalledWith("Discord callback error", {
      error: "Token exchange failed",
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
        discord: {
          pendingState: validState,
          stateCreatedAt: new Date().toISOString(),
        },
      },
    });

    mockExchangeCodeForTokens.mockResolvedValue({
      accessToken: "tok_test",
      refreshToken: "ref_test",
      expiresIn: 3600,
      guildId: "guild_123",
      guildName: "Test Server",
    });

    mockEncryptIntegrationData.mockReturnValue({ encrypted: true } as never);

    mockDbUpdate.mockImplementationOnce(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error("DB error")),
    }));

    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("error=Failed+to+connect+Discord");

    expect(mockLogger.error).toHaveBeenCalledWith("Discord callback error", {
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
