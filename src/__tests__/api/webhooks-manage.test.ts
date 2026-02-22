import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { webhooks: { findFirst: vi.fn(), findMany: vi.fn() }, users: { findFirst: vi.fn() } },
    mockDbInsert: vi.fn(() => ({ values: vi.fn().mockReturnThis(), returning: vi.fn(() => [{ id: "w1" }]) })),
    mockDbUpdate: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn(() => [{ id: "w1" }]) })),
    mockDbDelete: vi.fn(() => ({ where: vi.fn() })),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery, insert: () => mockDbInsert(), update: () => mockDbUpdate(), delete: () => mockDbDelete() },
}));
vi.mock("@/lib/db/schema", () => ({
  webhooks: { id: "id", userId: "user_id" },
  users: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(),
}));

import { POST } from "@/app/api/webhooks/manage/route";
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
  mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", subscriptionStatus: "enterprise" });
});

describe("POST /api/webhooks/manage", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/webhooks/manage", { url: "https://example.com", name: "Test" }));
    expect(res.status).toBe(401);
  });
});
