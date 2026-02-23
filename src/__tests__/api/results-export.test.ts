import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { monitors: { findMany: vi.fn() }, results: { findMany: vi.fn() } },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({ checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args) }));
vi.mock("@/lib/db", () => ({ db: { query: mockDbQuery } }));

import { GET } from "@/app/api/results/export/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

describe("GET /api/results/export", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(makeRequest("GET", "/api/results/export"));
    expect(res.status).toBe(401);
  });
});
