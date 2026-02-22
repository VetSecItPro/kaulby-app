import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbDelete, mockDbInsert } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { audiences: { findFirst: vi.fn() }, monitors: { findFirst: vi.fn() }, audienceMonitors: { findFirst: vi.fn() } },
    mockDbDelete: vi.fn(),
    mockDbInsert: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery, delete: () => mockDbDelete(), insert: () => mockDbInsert() },
  audiences: { id: "id", userId: "user_id" },
  monitors: { id: "id", userId: "user_id" },
  audienceMonitors: { audienceId: "audience_id", monitorId: "monitor_id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), inArray: vi.fn() }));

import { POST, DELETE } from "@/app/api/audiences/[id]/monitors/route";
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

describe("POST /api/audiences/[id]/monitors", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/audiences/aud_1/monitors", { monitorId: "mon_1" }), { params: Promise.resolve({ id: "aud_1" }) });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/audiences/[id]/monitors", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest("DELETE", "/api/audiences/aud_1/monitors", { monitorId: "mon_1" }), { params: Promise.resolve({ id: "aud_1" }) });
    expect(res.status).toBe(401);
  });
});
