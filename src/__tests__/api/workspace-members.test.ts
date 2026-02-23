import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbUpdate } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { users: { findFirst: vi.fn(), findMany: vi.fn() } },
    mockDbUpdate: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn() })),
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
    update: () => mockDbUpdate()
  },
}));
vi.mock("@/lib/db/schema", () => ({
  users: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  relations: vi.fn(),
}));
vi.mock("@/lib/auth-utils", () => ({
  findUserWithFallback: vi.fn((userId: string) => ({ id: userId, workspaceId: "ws_1", workspaceRole: "owner" })),
}));
vi.mock("@/lib/permissions", () => ({
  permissions: {
    canRemoveMembers: vi.fn(() => true),
    canModifyMember: vi.fn(() => true),
    canChangeRoles: vi.fn(() => true),
  },
  getAssignableRoles: vi.fn(() => ["admin", "editor", "viewer"]),
}));
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

import { DELETE } from "@/app/api/workspace/members/route";
import { PATCH } from "@/app/api/workspace/members/[memberId]/role/route";
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
  mockDbQuery.users.findFirst.mockResolvedValue({ id: "member_1", workspaceId: "ws_1", workspaceRole: "editor" });
});

describe("DELETE /api/workspace/members", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest("DELETE", "/api/workspace/members?memberId=member_1"));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/workspace/members/[memberId]/role", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(makeRequest("PATCH", "/api/workspace/members/m1/role", { role: "admin" }), { params: Promise.resolve({ memberId: "m1" }) });
    expect(res.status).toBe(401);
  });
});
