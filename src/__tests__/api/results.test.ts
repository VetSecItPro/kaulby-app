import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockGetEffectiveUserId,
  mockCheckApiRateLimit,
  mockDbQuery,
} = vi.hoisted(() => {
  return {
    mockGetEffectiveUserId: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      monitors: {
        findMany: vi.fn(),
      },
      results: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => ({ userId: null }) }));

vi.mock("@/lib/dev-auth", () => ({
  getEffectiveUserId: () => mockGetEffectiveUserId(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
  },
  monitors: { id: "id", userId: "user_id" },
  results: { monitorId: "monitor_id", isHidden: "is_hidden", createdAt: "created_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  inArray: vi.fn(),
  and: vi.fn(),
  lt: vi.fn(),
}));

// --- Imports ---
import { GET } from "@/app/api/results/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

// ==========================================
// GET /api/results
// ==========================================
describe("GET /api/results", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/results"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await GET(makeRequest("/api/results"));
    expect(res.status).toBe(429);
  });

  it("returns empty results when user has no monitors", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findMany.mockResolvedValue([]);
    const res = await GET(makeRequest("/api/results"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
    expect(json.hasMore).toBe(false);
    expect(json.nextCursor).toBeNull();
  });

  it("returns results with pagination info", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findMany.mockResolvedValue([{ id: "mon_1" }]);
    const mockResults = [
      {
        id: "r_1",
        platform: "reddit",
        sourceUrl: "https://reddit.com/r/test",
        title: "Test Post",
        content: "Some content",
        author: "user123",
        postedAt: new Date("2024-01-01"),
        sentiment: "positive",
        painPointCategory: null,
        conversationCategory: "discussion",
        aiSummary: "A test post",
        isViewed: false,
        isClicked: false,
        isSaved: false,
        isHidden: false,
        createdAt: new Date("2024-01-01"),
        monitor: { name: "Test Monitor", keywords: ["test"] },
      },
    ];
    mockDbQuery.results.findMany.mockResolvedValue(mockResults);

    const res = await GET(makeRequest("/api/results"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("r_1");
    expect(json.items[0].platform).toBe("reddit");
    expect(json.hasMore).toBe(false);
  });

  it("returns empty when monitorId filter does not match owned monitors", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findMany.mockResolvedValue([{ id: "mon_1" }]);
    const res = await GET(makeRequest("/api/results?monitorId=mon_other"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual([]);
  });

  it("handles cursor-based pagination", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findMany.mockResolvedValue([{ id: "mon_1" }]);
    // Return limit+1 items to indicate hasMore
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `r_${i}`,
      platform: "reddit",
      sourceUrl: `https://reddit.com/${i}`,
      title: `Post ${i}`,
      content: "content",
      author: "author",
      postedAt: new Date("2024-01-01"),
      sentiment: "neutral",
      painPointCategory: null,
      conversationCategory: null,
      aiSummary: null,
      isViewed: false,
      isClicked: false,
      isSaved: false,
      isHidden: false,
      createdAt: new Date(`2024-01-${String(20 - i).padStart(2, "0")}`),
      monitor: { name: "Test", keywords: [] },
    }));
    mockDbQuery.results.findMany.mockResolvedValue(items);

    const res = await GET(makeRequest("/api/results"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(20);
    expect(json.hasMore).toBe(true);
    expect(json.nextCursor).toBeDefined();
  });

  it("respects limit parameter", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findMany.mockResolvedValue([{ id: "mon_1" }]);
    mockDbQuery.results.findMany.mockResolvedValue([]);

    // The limit is parsed from the URL - we just verify the request succeeds
    const res = await GET(makeRequest("/api/results?limit=10"));
    expect(res.status).toBe(200);
  });
});
