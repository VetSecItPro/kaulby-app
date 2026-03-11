import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockDbUpdate,
  mockListGuildTextChannels,
  mockDecryptIntegrationData,
  mockEncryptIntegrationData,
  mockLogger,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { users: { findFirst: vi.fn() } },
    mockDbUpdate: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn() })),
    mockListGuildTextChannels: vi.fn(),
    mockDecryptIntegrationData: vi.fn(),
    mockEncryptIntegrationData: vi.fn(),
    mockLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    update: () => mockDbUpdate(),
  },
  users: {},
}));

vi.mock("drizzle-orm", () => ({ eq: vi.fn(), relations: vi.fn(), sql: vi.fn() }));

vi.mock("@/lib/integrations/discord", () => ({
  listGuildTextChannels: (...args: unknown[]) => mockListGuildTextChannels(...args),
}));

vi.mock("@/lib/encryption", () => ({
  decryptIntegrationData: (...args: unknown[]) => mockDecryptIntegrationData(...args),
  encryptIntegrationData: (...args: unknown[]) => mockEncryptIntegrationData(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

// --- Imports ---
import { GET, PATCH } from "@/app/api/integrations/discord/channels/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/integrations/discord/channels", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

// ==========================================
// GET /api/integrations/discord/channels
// ==========================================
describe("GET /api/integrations/discord/channels", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await GET();
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 400 when Discord not connected", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: { discord: { connected: false } },
    });
    const res = await GET();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Discord not connected");
  });

  it("returns 400 when no guild ID stored", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: { discord: { connected: true } },
    });
    const res = await GET();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("No guild ID stored");
  });

  it("returns 502 when listGuildTextChannels returns error", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: { discord: { connected: true, guildId: "12345678901234567890" } },
    });
    mockListGuildTextChannels.mockResolvedValue({
      channels: [],
      error: "Bot not in guild",
    });
    const res = await GET();
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("Failed to list channels");
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to list Discord channels",
      expect.objectContaining({ error: "Bot not in guild" })
    );
  });

  it("returns channels list and selected channel ID on success", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        discord: {
          connected: true,
          guildId: "12345678901234567890",
          channelId: "98765432109876543210",
        },
      },
    });
    mockListGuildTextChannels.mockResolvedValue({
      channels: [
        { id: "98765432109876543210", name: "general" },
        { id: "98765432109876543211", name: "alerts" },
      ],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.channels).toHaveLength(2);
    expect(json.channels[0]).toEqual({ id: "98765432109876543210", name: "general" });
    expect(json.selectedChannelId).toBe("98765432109876543210");
  });

  it("returns null selectedChannelId when none set", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        discord: {
          connected: true,
          guildId: "12345678901234567890",
        },
      },
    });
    mockListGuildTextChannels.mockResolvedValue({
      channels: [{ id: "98765432109876543210", name: "general" }],
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.selectedChannelId).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockDbQuery.users.findFirst.mockRejectedValue(new Error("Database error"));
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to list channels");
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error listing Discord channels",
      expect.objectContaining({ error: "Database error" })
    );
  });
});

// ==========================================
// PATCH /api/integrations/discord/channels
// ==========================================
describe("PATCH /api/integrations/discord/channels", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(makeRequest({ channelId: "12345678901234567890" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 45 });
    const res = await PATCH(makeRequest({ channelId: "12345678901234567890" }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("returns 400 when channelId missing from body", async () => {
    const res = await PATCH(makeRequest({ channelName: "test" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when channelId is not a string", async () => {
    const res = await PATCH(makeRequest({ channelId: 123 as never }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when channelId format invalid (too short)", async () => {
    const res = await PATCH(makeRequest({ channelId: "1234567890123456" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when channelId format invalid (too long)", async () => {
    const res = await PATCH(makeRequest({ channelId: "123456789012345678901" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when channelId format invalid (non-numeric)", async () => {
    const res = await PATCH(makeRequest({ channelId: "abc1234567890123456" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when Discord not connected", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: { discord: { connected: false } },
    });
    const res = await PATCH(makeRequest({ channelId: "12345678901234567890" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Discord not connected");
  });

  it("successfully saves channel ID with decryption and re-encryption", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        discord: {
          connected: true,
          guildId: "98765432109876543210",
          accessToken: "encrypted_token",
        },
      },
    });
    mockDecryptIntegrationData.mockReturnValue({
      connected: true,
      guildId: "98765432109876543210",
      accessToken: "decrypted_token",
    });
    mockEncryptIntegrationData.mockReturnValue({
      connected: true,
      guildId: "98765432109876543210",
      accessToken: "encrypted_token",
      channelId: "12345678901234567890",
      channelName: "alerts",
    });

    const res = await PATCH(
      makeRequest({
        channelId: "12345678901234567890",
        channelName: "alerts",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.channelId).toBe("12345678901234567890");
    expect(mockDecryptIntegrationData).toHaveBeenCalled();
    expect(mockEncryptIntegrationData).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "12345678901234567890",
        channelName: "alerts",
      })
    );
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("successfully saves channel ID without channelName", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1",
      integrations: {
        discord: {
          connected: true,
          guildId: "98765432109876543210",
        },
      },
    });
    mockDecryptIntegrationData.mockReturnValue({
      connected: true,
      guildId: "98765432109876543210",
    });
    mockEncryptIntegrationData.mockReturnValue({
      connected: true,
      guildId: "98765432109876543210",
      channelId: "12345678901234567890",
    });

    const res = await PATCH(makeRequest({ channelId: "12345678901234567890" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockEncryptIntegrationData).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "12345678901234567890",
        channelName: undefined,
      })
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockDbQuery.users.findFirst.mockRejectedValue(new Error("Database error"));
    const res = await PATCH(makeRequest({ channelId: "12345678901234567890" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to save channel selection");
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error saving Discord channel",
      expect.objectContaining({ error: "Database error" })
    );
  });
});
