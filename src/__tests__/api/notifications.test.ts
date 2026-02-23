import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockDbUpdate,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      notifications: { findMany: vi.fn() },
    },
    mockDbUpdate: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery, update: () => mockDbUpdate() },
}));
vi.mock("@/lib/db/schema", () => ({
  notifications: { userId: "user_id", isRead: "is_read", id: "id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), desc: vi.fn(), inArray: vi.fn() }));

import { GET, PATCH } from "@/app/api/notifications/route";

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


describe("GET /api/notifications", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/notifications", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(makeRequest("PATCH", "/api/notifications", { ids: ["n1"] }));
    expect(res.status).toBe(401);
  });
});

