import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { savedSearches: { findFirst: vi.fn(), findMany: vi.fn() } },
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
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
  savedSearches: { id: "id", userId: "user_id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(),
}));

import { GET, POST } from "@/app/api/saved-searches/route";
import { PATCH, DELETE } from "@/app/api/saved-searches/[id]/route";
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

describe("GET /api/saved-searches", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/saved-searches", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/saved-searches", { name: "Test" }));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/saved-searches/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(makeRequest("PATCH", "/api/saved-searches/s1", { name: "Updated" }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/saved-searches/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest("DELETE", "/api/saved-searches/s1"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(401);
  });
});
