import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbInsert, mockDbDelete } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      users: { findFirst: vi.fn() },
      workspaces: { findFirst: vi.fn() },
      workspaceInvites: { findFirst: vi.fn(), findMany: vi.fn() }
    },
    mockDbInsert: vi.fn(() => ({ values: vi.fn().mockReturnThis(), returning: vi.fn(() => [{ id: "inv_1", email: "test@test.com" }]) })),
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
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    delete: () => mockDbDelete()
  },
}));
vi.mock("@/lib/db/schema", () => ({
  workspaces: {},
  workspaceInvites: {},
  users: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendWorkspaceInviteEmail: vi.fn(),
}));
vi.mock("@/lib/auth-utils", () => ({
  findUserWithFallback: vi.fn((userId: string) => ({ id: userId, workspaceId: "ws_1", workspaceRole: "owner", email: "owner@test.com" })),
}));
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

import { POST } from "@/app/api/workspace/invite/route";
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
  mockDbQuery.workspaces.findFirst.mockResolvedValue({ id: "ws_1", name: "Test Workspace", seatCount: 1, seatLimit: 10 });
});

describe("POST /api/workspace/invite", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "test@test.com" }));
    expect(res.status).toBe(401);
  });

  // ── FullTest J3: invite + email send (PR #306+) ──────────────────────
  it("J3 owner invites member: 201 + invite returned + email send attempted", async () => {
    // Setup: workspace with seats available, no existing member, no existing invite
    mockDbQuery.users.findFirst.mockResolvedValueOnce(null);          // existing-member check
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValueOnce(null); // pending-invite check
    const emailMod = await import("@/lib/email");
    vi.mocked(emailMod.sendWorkspaceInviteEmail).mockResolvedValueOnce(undefined as never);

    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "newmember@test.com" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.invite).toBeDefined();
    expect(json.invite.email).toBe("test@test.com"); // mockDbInsert returning value
    expect(emailMod.sendWorkspaceInviteEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emailMod.sendWorkspaceInviteEmail).mock.calls[0][0])
      .toMatchObject({ workspaceName: "Test Workspace" });
  });

  // ── FullTest J3-fallback: email failure doesn't fail the request ─────
  it("J3 invite still 201 even when email send throws (best-effort)", async () => {
    mockDbQuery.users.findFirst.mockResolvedValueOnce(null);
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValueOnce(null);
    const emailMod = await import("@/lib/email");
    vi.mocked(emailMod.sendWorkspaceInviteEmail).mockRejectedValueOnce(new Error("Resend down"));

    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "newmember@test.com" }));
    expect(res.status).toBe(201);
    // Invite row created in DB even though email failed — user can resend later
  });

  // ── FullTest J10: cannot invite when seatCount === seatLimit ─────────
  it("J10 returns 403 when seat limit reached (seatCount === seatLimit)", async () => {
    mockDbQuery.workspaces.findFirst.mockResolvedValueOnce({
      id: "ws_1", name: "Full Workspace", seatCount: 3, seatLimit: 3,
    });
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "newmember@test.com" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Seat limit reached");
  });

  // ── FullTest J10b: invite blocked when seatCount > seatLimit (corruption-resilient) ─
  it("J10b returns 403 when seatCount somehow exceeds seatLimit", async () => {
    mockDbQuery.workspaces.findFirst.mockResolvedValueOnce({
      id: "ws_1", name: "Over-Subscribed", seatCount: 4, seatLimit: 3,
    });
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "x@test.com" }));
    expect(res.status).toBe(403);
  });

  // ── FullTest J3: only owner can invite (admin role rejected) ─────────
  it("J3 returns 403 when caller has 'admin' role (only owner can invite)", async () => {
    const auth = await import("@/lib/auth-utils");
    vi.mocked(auth.findUserWithFallback).mockResolvedValueOnce({
      id: "user_1", workspaceId: "ws_1", workspaceRole: "admin",
      email: "admin@test.com", name: "Admin",
    } as never);
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "x@test.com" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Only workspace owners");
  });

  // ── FullTest J3: missing/invalid email ───────────────────────────────
  it("J3 returns 400 when email is missing or invalid", async () => {
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "" }));
    expect(res.status).toBe(400);
  });

  // ── FullTest J3: duplicate invite for same email rejected ────────────
  it("J3 returns 400 when invite already pending for email", async () => {
    mockDbQuery.users.findFirst.mockResolvedValueOnce(null);
    // pending invite that hasn't expired
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValueOnce({
      id: "inv_existing",
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // +1 day
    });
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "pending@test.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("already pending");
  });

  // ── FullTest J3: existing member rejected ────────────────────────────
  it("J3 returns 400 when invitee is already a member of the workspace", async () => {
    mockDbQuery.users.findFirst.mockResolvedValueOnce({ id: "user_2", workspaceId: "ws_1" });
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "existing@test.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("already a member");
  });
});
