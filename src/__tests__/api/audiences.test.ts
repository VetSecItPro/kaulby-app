import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      audiences: {
        findFirst: vi.fn(),
      },
    },
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
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    update: () => mockDbUpdate(),
    delete: () => mockDbDelete(),
  },
  audiences: { id: "id", userId: "user_id" },
}));
vi.mock("@/lib/db/schema", () => ({ audiences: { id: "id", userId: "user_id" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn() }));

import { POST } from "@/app/api/audiences/route";
import { PATCH, DELETE } from "@/app/api/audiences/[id]/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(`http://localhost${url}`, init);
}

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

describe("POST /api/audiences", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/audiences", { name: "Test" }));
    expect(res.status).toBe(401);
  });

  it("creates audience successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "aud_1", name: "Test", userId: "user_1" }]),
      }),
    });
    const res = await POST(makeRequest("POST", "/api/audiences", { name: "Test" }));
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/audiences/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(makeRequest("PATCH", "/api/audiences/aud_1", { name: "Updated" }), makeRouteContext("aud_1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when audience not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.audiences.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest("PATCH", "/api/audiences/aud_1", { name: "Updated" }), makeRouteContext("aud_1"));
    expect(res.status).toBe(404);
  });

  it("updates audience successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.audiences.findFirst.mockResolvedValue({ id: "aud_1", userId: "user_1" });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "aud_1", name: "Updated" }]),
        }),
      }),
    });
    const res = await PATCH(makeRequest("PATCH", "/api/audiences/aud_1", { name: "Updated" }), makeRouteContext("aud_1"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/audiences/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest("DELETE", "/api/audiences/aud_1"), makeRouteContext("aud_1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when audience not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.audiences.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE", "/api/audiences/aud_1"), makeRouteContext("aud_1"));
    expect(res.status).toBe(404);
  });

  it("deletes audience successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.audiences.findFirst.mockResolvedValue({ id: "aud_1", userId: "user_1" });
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const res = await DELETE(makeRequest("DELETE", "/api/audiences/aud_1"), makeRouteContext("aud_1"));
    expect(res.status).toBe(200);
  });
});
