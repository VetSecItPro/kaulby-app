import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetEffectiveUserId,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockGetUserPlan,
} = vi.hoisted(() => {
  return {
    mockGetEffectiveUserId: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      monitors: { findMany: vi.fn() },
      results: { findMany: vi.fn() },
    },
    mockGetUserPlan: vi.fn(),
  };
});

vi.mock("@/lib/dev-auth", () => ({ getEffectiveUserId: () => mockGetEffectiveUserId() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery },
}));
vi.mock("@/lib/db/schema", () => ({
  monitors: { userId: "user_id" },
  results: { monitorId: "monitor_id", createdAt: "created_at" },
}));
vi.mock("@/lib/limits", () => ({
  getUserPlan: () => mockGetUserPlan(),
}));
vi.mock("@/lib/plans", () => ({
  getPlanLimits: () => ({ platforms: ["reddit", "hackernews"] }),
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), inArray: vi.fn(), gte: vi.fn(), desc: vi.fn() }));

import { GET } from "@/app/api/insights/route";

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
  mockGetUserPlan.mockResolvedValue("free");
});


describe("GET /api/insights", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await GET(makeRequest("GET", "/api/insights"));
    expect(res.status).toBe(401);
  });
});

