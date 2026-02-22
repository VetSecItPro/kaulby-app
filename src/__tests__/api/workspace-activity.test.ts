import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { users: { findFirst: vi.fn() }, activityLogs: { findMany: vi.fn() } },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({ checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args) }));
vi.mock("@/lib/db", () => ({ db: { query: mockDbQuery } }));

import { GET } from "@/app/api/workspace/activity/route";
import { NextRequest } from "next/server";

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

describe("GET /api/workspace/activity", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(new NextRequest("http://localhost/api/workspace/activity"));
    expect(res.status).toBe(401);
  });
});
