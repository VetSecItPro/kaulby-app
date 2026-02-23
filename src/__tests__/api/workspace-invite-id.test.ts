import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockFindUserWithFallback,
  mockDbQuery,
  mockDbDelete,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockFindUserWithFallback: vi.fn(),
    mockDbQuery: { workspaceInvites: { findFirst: vi.fn() } },
    mockDbDelete: vi.fn(() => ({ where: vi.fn() })),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("@/lib/auth-utils", () => ({
  findUserWithFallback: (...args: unknown[]) => mockFindUserWithFallback(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    delete: () => mockDbDelete(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  workspaceInvites: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// --- Imports ---
import { DELETE } from "@/app/api/workspace/invite/[id]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

// ==========================================
// DELETE /api/workspace/invite/[id]
// ==========================================
describe("DELETE /api/workspace/invite/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 403 when user has no workspace", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: null,
      workspaceRole: null,
    });
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Only workspace owners can revoke invites");
  });

  it("returns 403 when user is not workspace owner", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_1",
      workspaceRole: "member",
    });
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Only workspace owners can revoke invites");
  });

  it("returns 403 when user role is admin (not owner)", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_1",
      workspaceRole: "admin",
    });
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("Only workspace owners can revoke invites");
  });

  it("returns 404 when invite not found", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_1",
      workspaceRole: "owner",
    });
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_nonexistent" }) }
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Invite not found");
  });

  it("returns 404 when invite belongs to different workspace", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_1",
      workspaceRole: "owner",
    });
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Invite not found");
  });

  it("successfully revokes invite and returns success", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_1",
      workspaceRole: "owner",
    });
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValue({
      id: "inv_1",
      workspaceId: "ws_1",
      email: "invitee@example.com",
      role: "member",
      createdAt: new Date(),
    });

    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it("successfully revokes invite when user is found via fallback email", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_alternate",
      workspaceId: "ws_1",
      workspaceRole: "owner",
    });
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValue({
      id: "inv_2",
      workspaceId: "ws_1",
      email: "another@example.com",
      role: "admin",
      createdAt: new Date(),
    });

    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_2", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_2" }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 500 on unexpected error during findUserWithFallback", async () => {
    mockFindUserWithFallback.mockRejectedValue(new Error("Database connection failed"));
    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to revoke invite");
  });

  it("returns 500 on unexpected error during invite deletion", async () => {
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_1",
      workspaceRole: "owner",
    });
    mockDbQuery.workspaceInvites.findFirst.mockResolvedValue({
      id: "inv_1",
      workspaceId: "ws_1",
      email: "invitee@example.com",
      role: "member",
      createdAt: new Date(),
    });
    mockDbDelete.mockImplementation(() => {
      throw new Error("Delete operation failed");
    });

    const res = await DELETE(
      new Request("http://localhost/api/workspace/invite/inv_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "inv_1" }) }
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to revoke invite");
  });
});
