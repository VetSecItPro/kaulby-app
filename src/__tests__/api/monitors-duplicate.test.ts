import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbInsert, mockCanCreateMonitor } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { monitors: { findFirst: vi.fn() } },
    mockDbInsert: vi.fn(),
    mockCanCreateMonitor: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery, insert: () => mockDbInsert() },
}));
vi.mock("@/lib/db/schema", () => ({
  monitors: { id: "id", userId: "user_id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));
vi.mock("@/lib/limits", () => ({
  canCreateMonitor: () => mockCanCreateMonitor(),
}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { POST } from "@/app/api/monitors/[id]/duplicate/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockCanCreateMonitor.mockResolvedValue({ allowed: true });
});

describe("POST /api/monitors/[id]/duplicate", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/monitors/mon_1/duplicate"), { params: Promise.resolve({ id: "mon_1" }) });
    expect(res.status).toBe(401);
  });
});
