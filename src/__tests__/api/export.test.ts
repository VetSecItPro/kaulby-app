import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockDbQuery,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      users: { findFirst: vi.fn() },
      monitors: { findMany: vi.fn() },
      results: { findMany: vi.fn() },
      audiences: { findMany: vi.fn() },
      webhooks: { findMany: vi.fn() },
      alerts: { findMany: vi.fn() },
    },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery },
}));
vi.mock("@/lib/db/schema", () => ({
  users: { id: "id" },
  monitors: { userId: "user_id" },
  results: { monitorId: "monitor_id" },
  audiences: { userId: "user_id" },
  webhooks: { userId: "user_id" },
  alerts: { monitorId: "monitor_id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), inArray: vi.fn() }));
vi.mock("@/lib/plans", () => ({
  getPlanLimits: () => ({ exports: { csv: true } }),
}));

import { GET } from "@/app/api/export/route";

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
  mockAuth.mockResolvedValue({ userId: "user_1" });
});


describe("GET /api/export", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(makeRequest("GET", "/api/export"));
    expect(res.status).toBe(401);
  });
});

