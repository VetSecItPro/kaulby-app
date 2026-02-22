import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockGetEffectiveUserId,
  mockCheckApiRateLimit,
  mockGetUserPlan,
  mockDbQuery,
  mockDbSelect,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockGetEffectiveUserId: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockGetUserPlan: vi.fn(),
    mockDbQuery: {
      monitors: {
        findMany: vi.fn(),
      },
    },
    mockDbSelect: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/dev-auth", () => ({
  getEffectiveUserId: () => mockGetEffectiveUserId(),
}));

vi.mock("@/lib/limits", () => ({
  getUserPlan: (...args: unknown[]) => mockGetUserPlan(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    select: () => mockDbSelect(),
  },
  results: { monitorId: "monitor_id", createdAt: "created_at", sentiment: "sentiment", platform: "platform", conversationCategory: "conversation_category" },
  monitors: { userId: "user_id" },
}));

vi.mock("@/lib/db/schema", () => ({
  results: { monitorId: "monitor_id", createdAt: "created_at", sentiment: "sentiment", platform: "platform", conversationCategory: "conversation_category" },
  monitors: { userId: "user_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  inArray: vi.fn(),
  gte: vi.fn(),
  and: vi.fn(),
  sql: Object.assign(
    function sql() {
      return { as: vi.fn(() => "SQL_FIELD") };
    },
    { raw: vi.fn() }
  ),
  count: vi.fn(() => ({ as: vi.fn(() => "count") })),
}));

// --- Imports ---
import { GET } from "@/app/api/analytics/route";
import { GET as GET_SHARE_OF_VOICE } from "@/app/api/analytics/share-of-voice/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockGetUserPlan.mockResolvedValue("enterprise");
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

// ==========================================
// GET /api/analytics
// ==========================================
describe("GET /api/analytics", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await GET(makeRequest("GET", "/api/analytics"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await GET(makeRequest("GET", "/api/analytics"));
    expect(res.status).toBe(429);
  });

  it("returns empty analytics when user has no monitors", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findMany.mockResolvedValue([]);
    const res = await GET(makeRequest("GET", "/api/analytics?range=30d"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totals.mentions).toBe(0);
  });
});

// ==========================================
// GET /api/analytics/share-of-voice
// ==========================================
describe("GET /api/analytics/share-of-voice", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET_SHARE_OF_VOICE(makeRequest("GET", "/api/analytics/share-of-voice"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not enterprise", async () => {
    mockGetUserPlan.mockResolvedValue("pro");
    const res = await GET_SHARE_OF_VOICE(makeRequest("GET", "/api/analytics/share-of-voice"));
    expect(res.status).toBe(403);
  });
});
