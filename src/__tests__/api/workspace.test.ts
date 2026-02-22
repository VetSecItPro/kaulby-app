import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockFindUserWithFallback,
  mockLogActivity,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockFindUserWithFallback: vi.fn(),
    mockLogActivity: vi.fn(),
    mockDbQuery: {
      workspaces: {
        findFirst: vi.fn(),
      },
      users: {
        findMany: vi.fn(),
      },
    },
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));

vi.mock("@/lib/auth-utils", () => ({
  findUserWithFallback: (...args: unknown[]) => mockFindUserWithFallback(...args),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    update: () => mockDbUpdate(),
  },
  workspaces: { id: "id", ownerId: "owner_id" },
  users: { id: "id", workspaceId: "workspace_id" },
}));

vi.mock("@/lib/db/schema", () => ({
  workspaces: { id: "id", ownerId: "owner_id" },
  users: { id: "id", workspaceId: "workspace_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// --- Imports ---
import { GET, POST } from "@/app/api/workspace/route";
import { NextRequest } from "next/server";

// --- Helpers ---

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
  mockLogActivity.mockResolvedValue(undefined);
});

// ==========================================
// GET /api/workspace
// ==========================================
describe("GET /api/workspace", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns null workspace when user has no workspace", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.workspace).toBeNull();
  });

  it("returns workspace with members when user is in workspace", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_1",
      workspaceRole: "owner",
    });
    mockDbQuery.workspaces.findFirst.mockResolvedValue({
      id: "ws_1",
      name: "Acme Team",
      ownerId: "user_1",
      seatLimit: 5,
      seatCount: 2,
    });
    mockDbQuery.users.findMany.mockResolvedValue([
      { id: "user_1", email: "owner@acme.com", name: "Owner", workspaceRole: "owner" },
      { id: "user_2", email: "member@acme.com", name: "Member", workspaceRole: "member" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.workspace).toBeDefined();
    expect(json.workspace.name).toBe("Acme Team");
    expect(json.workspace.members).toHaveLength(2);
    expect(json.role).toBe("owner");
  });

  it("returns null workspace when workspace record not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      workspaceId: "ws_deleted",
      workspaceRole: "owner",
    });
    mockDbQuery.workspaces.findFirst.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.workspace).toBeNull();
  });
});

// ==========================================
// POST /api/workspace
// ==========================================
describe("POST /api/workspace", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/workspace", { name: "My Team" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    const res = await POST(makeRequest("POST", "/api/workspace", { name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("name is required");
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", "/api/workspace", { name: "My Team" }));
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not enterprise", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      subscriptionStatus: "pro",
      workspaceId: null,
    });
    const res = await POST(makeRequest("POST", "/api/workspace", { name: "My Team" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Enterprise plan");
  });

  it("returns 400 when user already has a workspace", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      subscriptionStatus: "enterprise",
      workspaceId: "ws_existing",
    });
    const res = await POST(makeRequest("POST", "/api/workspace", { name: "My Team" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("already in a workspace");
  });

  it("creates workspace successfully for enterprise user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindUserWithFallback.mockResolvedValue({
      id: "user_1",
      subscriptionStatus: "enterprise",
      workspaceId: null,
    });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "ws_new",
          name: "My Team",
          ownerId: "user_1",
          seatLimit: 5,
          seatCount: 1,
        }]),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const res = await POST(makeRequest("POST", "/api/workspace", { name: "My Team" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.workspace).toBeDefined();
    expect(json.workspace.id).toBe("ws_new");
    expect(json.workspace.name).toBe("My Team");
    expect(mockLogActivity).toHaveBeenCalled();
  });
});
