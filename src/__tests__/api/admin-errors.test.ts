import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockDbSelect,
  mockDbUpdate,
  mockDbDelete,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      users: {
        findFirst: vi.fn(),
      },
      errorLogs: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    mockDbSelect: vi.fn(),
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
    select: () => mockDbSelect(),
    update: () => mockDbUpdate(),
    delete: () => mockDbDelete(),
  },
  errorLogs: { id: "id", level: "level", source: "source", resolved: "resolved", createdAt: "created_at" },
  users: { id: "id" },
}));

vi.mock("@/lib/db/schema", () => ({
  errorLogs: { id: "id", level: "level", source: "source", resolved: "resolved", createdAt: "created_at" },
  users: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn((...args) => args),
  gte: vi.fn(),
  lte: vi.fn(),
  or: vi.fn(),
  ilike: vi.fn(),
  count: vi.fn(() => "COUNT(*)"),
  sql: Object.assign(
    function sql() {
      return "SQL_EXPRESSION";
    },
    {
      raw: vi.fn(),
    }
  ),
}));

// --- Imports ---
import { GET } from "@/app/api/admin/errors/route";
import { GET as GET_BY_ID, PATCH, DELETE } from "@/app/api/admin/errors/[id]/route";
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

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

// ==========================================
// GET /api/admin/errors
// ==========================================
describe("GET /api/admin/errors", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(makeRequest("GET", "/api/admin/errors"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", isAdmin: false });
    const res = await GET(makeRequest("GET", "/api/admin/errors"));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await GET(makeRequest("GET", "/api/admin/errors"));
    expect(res.status).toBe(429);
  });

  it("returns error logs with pagination and stats", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 25 }]),
      }),
    });

    mockDbQuery.errorLogs.findMany.mockResolvedValue([
      { id: "err_1", message: "Error 1", level: "error", resolved: false },
      { id: "err_2", message: "Error 2", level: "warning", resolved: true },
    ]);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalErrors: 25,
          unresolvedCount: 10,
          errorCount: 15,
          warningCount: 8,
          fatalCount: 2,
        }]),
      }),
    });

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([
            { source: "api", count: 15 },
            { source: "inngest", count: 10 },
          ]),
        }),
      }),
    });

    const res = await GET(makeRequest("GET", "/api/admin/errors?page=1&limit=50"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.errors).toBeDefined();
    expect(json.pagination).toBeDefined();
    expect(json.stats).toBeDefined();
  });

  it("applies filters correctly", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    });

    mockDbQuery.errorLogs.findMany.mockResolvedValue([]);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          totalErrors: 5,
          unresolvedCount: 2,
          errorCount: 3,
          warningCount: 2,
          fatalCount: 0,
        }]),
      }),
    });

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const res = await GET(makeRequest("GET", "/api/admin/errors?level=error&resolved=false"));
    expect(res.status).toBe(200);
  });
});

// ==========================================
// GET /api/admin/errors/[id]
// ==========================================
describe("GET /api/admin/errors/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET_BY_ID(
      makeRequest("GET", "/api/admin/errors/err_1"),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", isAdmin: false });
    const res = await GET_BY_ID(
      makeRequest("GET", "/api/admin/errors/err_1"),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when error log not found", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.errorLogs.findFirst.mockResolvedValue(null);
    const res = await GET_BY_ID(
      makeRequest("GET", "/api/admin/errors/err_1"),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(404);
  });

  it("returns error log successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.errorLogs.findFirst.mockResolvedValue({
      id: "err_1",
      message: "Test error",
      level: "error",
      resolved: false,
    });
    const res = await GET_BY_ID(
      makeRequest("GET", "/api/admin/errors/err_1"),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("err_1");
  });
});

// ==========================================
// PATCH /api/admin/errors/[id]
// ==========================================
describe("PATCH /api/admin/errors/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/errors/err_1", { resolved: true }),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", isAdmin: false });
    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/errors/err_1", { resolved: true }),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when error log not found", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.errorLogs.findFirst.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/errors/err_1", { resolved: true }),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(404);
  });

  it("updates error log successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.errorLogs.findFirst.mockResolvedValue({ id: "err_1", resolved: false });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "err_1",
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: "admin_1",
          }]),
        }),
      }),
    });

    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/errors/err_1", { resolved: true }),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.resolved).toBe(true);
  });
});

// ==========================================
// DELETE /api/admin/errors/[id]
// ==========================================
describe("DELETE /api/admin/errors/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(
      makeRequest("DELETE", "/api/admin/errors/err_1"),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", isAdmin: false });
    const res = await DELETE(
      makeRequest("DELETE", "/api/admin/errors/err_1"),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(403);
  });

  it("deletes error log successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await DELETE(
      makeRequest("DELETE", "/api/admin/errors/err_1"),
      makeRouteContext("err_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
