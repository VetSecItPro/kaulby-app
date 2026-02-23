import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

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
      users: {
        findFirst: vi.fn(),
      },
      budgetAlerts: {
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

vi.mock("@/lib/security", () => ({
  isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  sanitizeUrl: (url: string) => url,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    update: () => mockDbUpdate(),
    delete: () => mockDbDelete(),
  },
  budgetAlerts: { id: "id" },
  users: { id: "id" },
}));

vi.mock("@/lib/db/schema", () => ({
  budgetAlerts: { id: "id" },
  users: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// --- Imports ---
import { POST } from "@/app/api/admin/budget-alerts/route";
import { PATCH, DELETE } from "@/app/api/admin/budget-alerts/[id]/route";
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
// POST /api/admin/budget-alerts
// ==========================================
describe("POST /api/admin/budget-alerts", () => {
  const validBody = {
    name: "Monthly Budget",
    period: "monthly",
    thresholdUsd: 1000,
    warningPercent: 80,
    notifyEmail: "admin@test.com",
  };

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", isAdmin: false });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", validBody));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", { ...validBody, name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Name is required");
  });

  it("returns 400 when period is invalid", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", { ...validBody, period: "yearly" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Period must be");
  });

  it("returns 400 when threshold is not positive", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", { ...validBody, thresholdUsd: -100 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Threshold must be");
  });

  it("returns 400 when email is invalid", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", { ...validBody, notifyEmail: "invalid-email" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("email");
  });

  it("returns 400 when Slack webhook is invalid", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", {
      ...validBody,
      notifySlack: "https://example.com/hook"
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Slack webhook");
  });

  it("creates budget alert successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "alert_1",
          name: "Monthly Budget",
          period: "monthly",
          thresholdUsd: 1000,
          warningPercent: 80,
          notifyEmail: "admin@test.com",
          isActive: true,
        }]),
      }),
    });

    const res = await POST(makeRequest("POST", "/api/admin/budget-alerts", validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.alert).toBeDefined();
    expect(json.alert.id).toBe("alert_1");
  });
});

// ==========================================
// PATCH /api/admin/budget-alerts/[id]
// ==========================================
describe("PATCH /api/admin/budget-alerts/[id]", () => {
  const updateBody = { name: "Updated Alert" };

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/budget-alerts/alert_1", updateBody),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", isAdmin: false });
    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/budget-alerts/alert_1", updateBody),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when alert not found", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.budgetAlerts.findFirst.mockResolvedValue(null);
    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/budget-alerts/alert_1", updateBody),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when name is invalid", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.budgetAlerts.findFirst.mockResolvedValue({ id: "alert_1" });
    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/budget-alerts/alert_1", { name: "" }),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(400);
  });

  it("updates alert successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.budgetAlerts.findFirst.mockResolvedValue({ id: "alert_1" });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "alert_1",
            name: "Updated Alert",
          }]),
        }),
      }),
    });

    const res = await PATCH(
      makeRequest("PATCH", "/api/admin/budget-alerts/alert_1", updateBody),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alert.name).toBe("Updated Alert");
  });
});

// ==========================================
// DELETE /api/admin/budget-alerts/[id]
// ==========================================
describe("DELETE /api/admin/budget-alerts/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(
      makeRequest("DELETE", "/api/admin/budget-alerts/alert_1"),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", isAdmin: false });
    const res = await DELETE(
      makeRequest("DELETE", "/api/admin/budget-alerts/alert_1"),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when alert not found", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.budgetAlerts.findFirst.mockResolvedValue(null);
    const res = await DELETE(
      makeRequest("DELETE", "/api/admin/budget-alerts/alert_1"),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(404);
  });

  it("deletes alert successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "admin_1" });
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "admin_1", isAdmin: true });
    mockDbQuery.budgetAlerts.findFirst.mockResolvedValue({ id: "alert_1" });
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await DELETE(
      makeRequest("DELETE", "/api/admin/budget-alerts/alert_1"),
      makeRouteContext("alert_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
