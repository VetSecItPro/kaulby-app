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

  // ── FullTest J6: member removal succeeds (seatCount decrement is downstream) ──
  it("J6 owner removes a member: 200 + member.workspaceId nulled + activity logged", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "member_1", workspaceId: "ws_1", workspaceRole: "editor",
      email: "ed@test.com", name: "Editor",
    });
    const res = await DELETE(makeRequest("DELETE", "/api/workspace/members?memberId=member_1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
    const activity = await import("@/lib/activity-log");
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member_removed", targetId: "member_1" })
    );
  });

  // ── FullTest J7: owner cannot remove themselves (rejects "leave workspace") ──
  it("J7 owner cannot remove themselves (must transfer ownership first)", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1", workspaceId: "ws_1", workspaceRole: "owner",
      email: "owner@test.com", name: "Owner",
    });
    const res = await DELETE(makeRequest("DELETE", "/api/workspace/members?memberId=user_1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("cannot remove yourself");
  });

  // ── FullTest J7b: cannot remove the workspace owner via member removal ──
  it("J7b cannot remove the workspace owner", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "owner_2", workspaceId: "ws_1", workspaceRole: "owner",
      email: "owner2@test.com", name: "Owner2",
    });
    const auth = await import("@/lib/auth-utils");
    vi.mocked(auth.findUserWithFallback).mockResolvedValueOnce({
      id: "admin_1", workspaceId: "ws_1", workspaceRole: "admin",
    } as never);
    const res = await DELETE(makeRequest("DELETE", "/api/workspace/members?memberId=owner_2"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Cannot remove the workspace owner");
  });

  // ── FullTest J6: cross-workspace removal blocked ──
  it("J6b cannot remove a member from a different workspace", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "member_x", workspaceId: "ws_other", workspaceRole: "editor",
    });
    const res = await DELETE(makeRequest("DELETE", "/api/workspace/members?memberId=member_x"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("not in your workspace");
  });

  // ── FullTest J6: missing memberId ──
  it("J6 returns 400 when memberId query param missing", async () => {
    const res = await DELETE(makeRequest("DELETE", "/api/workspace/members"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/workspace/members/[memberId]/role", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(makeRequest("PATCH", "/api/workspace/members/m1/role", { role: "admin" }), { params: Promise.resolve({ memberId: "m1" }) });
    expect(res.status).toBe(401);
  });

  // ── FullTest J5: owner changes member role admin → editor ──
  it("J5 owner changes member role admin → editor: 200 + activity logged", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "member_1", workspaceId: "ws_1", workspaceRole: "admin",
      email: "m@test.com", name: "Mem",
    });
    const res = await PATCH(
      makeRequest("PATCH", "/api/workspace/members/member_1/role", { role: "editor" }),
      { params: Promise.resolve({ memberId: "member_1" }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.role).toBe("editor");
    const activity = await import("@/lib/activity-log");
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member_role_changed",
        metadata: expect.objectContaining({ oldRole: "admin", newRole: "editor" }),
      })
    );
  });

  // ── FullTest J5: invalid role rejected ──
  it("J5 invalid role rejected with 400", async () => {
    const res = await PATCH(
      makeRequest("PATCH", "/api/workspace/members/m1/role", { role: "superuser" }),
      { params: Promise.resolve({ memberId: "m1" }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid role");
  });

  // ── FullTest J5: cannot change own role ──
  it("J5 user cannot change their own role", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "user_1", workspaceId: "ws_1", workspaceRole: "owner",
      email: "u@test.com",
    });
    const res = await PATCH(
      makeRequest("PATCH", "/api/workspace/members/user_1/role", { role: "admin" }),
      { params: Promise.resolve({ memberId: "user_1" }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("change your own role");
  });

  // ── FullTest J5: cannot change owner's role ──
  it("J5 cannot change the workspace owner's role", async () => {
    mockDbQuery.users.findFirst.mockResolvedValue({
      id: "owner_2", workspaceId: "ws_1", workspaceRole: "owner",
    });
    const auth = await import("@/lib/auth-utils");
    vi.mocked(auth.findUserWithFallback).mockResolvedValueOnce({
      id: "admin_1", workspaceId: "ws_1", workspaceRole: "admin",
    } as never);
    const res = await PATCH(
      makeRequest("PATCH", "/api/workspace/members/owner_2/role", { role: "editor" }),
      { params: Promise.resolve({ memberId: "owner_2" }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("workspace owner's role");
  });
});
