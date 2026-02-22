import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { users: { findFirst: vi.fn() } },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({ checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args) }));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery },
}));
vi.mock("@/lib/db/schema", () => ({
  users: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { GET } from "@/app/api/user/day-pass/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

describe("GET /api/user/day-pass", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
