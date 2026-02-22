import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetEffectiveUserId,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockDbSelect,
} = vi.hoisted(() => {
  return {
    mockGetEffectiveUserId: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      monitors: { findMany: vi.fn() },
      results: { findMany: vi.fn() },
    },
    mockDbSelect: vi.fn(),
  };
});

vi.mock("@/lib/dev-auth", () => ({ getEffectiveUserId: () => mockGetEffectiveUserId() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));
vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    select: () => mockDbSelect(),
  },
}));
vi.mock("@/lib/db/schema", () => ({
  results: { monitorId: "monitor_id", createdAt: "created_at", isViewed: "is_viewed", isHidden: "is_hidden", conversationCategory: "conversation_category", leadScore: "lead_score", sentiment: "sentiment", engagementScore: "engagement_score", isClicked: "is_clicked" },
  monitors: { userId: "user_id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  gte: vi.fn(),
  desc: vi.fn(),
  or: vi.fn(),
  count: vi.fn(() => "count_fn"),
}));

import { GET } from "@/app/api/dashboard/insights/route";

import { NextRequest } from "next/server";

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
  mockGetEffectiveUserId.mockResolvedValue("user_1");
});


describe("GET /api/dashboard/insights", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

