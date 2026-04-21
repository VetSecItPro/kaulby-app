import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockGetEffectiveUserId,
  mockVerifyUserInDb,
  mockCanCreateMonitor,
  mockCheckKeywordsLimit,
  mockGetUserPlan,
  mockFilterAllowedPlatforms,
  mockGetUpgradePrompt,
  mockDbQuery,
  mockDbInsert,
  mockDbDelete,
  mockDbUpdate,
  mockDbTransaction,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockGetEffectiveUserId: vi.fn(),
    mockVerifyUserInDb: vi.fn(),
    mockCanCreateMonitor: vi.fn(),
    mockCheckKeywordsLimit: vi.fn(),
    mockGetUserPlan: vi.fn(),
    mockFilterAllowedPlatforms: vi.fn(),
    mockGetUpgradePrompt: vi.fn(),
    mockDbQuery: {
      monitors: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbTransaction: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));

vi.mock("@/lib/dev-auth", () => ({
  getEffectiveUserId: () => mockGetEffectiveUserId(),
  verifyUserInDb: (...args: unknown[]) => mockVerifyUserInDb(...args),
  isLocalDev: () => false,
}));

vi.mock("@/lib/limits", () => ({
  canCreateMonitor: (...args: unknown[]) => mockCanCreateMonitor(...args),
  checkKeywordsLimit: (...args: unknown[]) => mockCheckKeywordsLimit(...args),
  getUserPlan: (...args: unknown[]) => mockGetUserPlan(...args),
  filterAllowedPlatforms: (...args: unknown[]) => mockFilterAllowedPlatforms(...args),
  getUpgradePrompt: (...args: unknown[]) => mockGetUpgradePrompt(...args),
}));

vi.mock("@/lib/plans", () => ({
  ALL_PLATFORMS: ["reddit", "hackernews", "producthunt", "devto", "google_reviews", "trustpilot", "appstore", "playstore", "quora", "youtube", "g2", "yelp", "amazon_reviews", "indiehackers", "github", "hashnode", "twitter"],
  getPlanLimits: () => ({}),
}));

vi.mock("@/lib/security", () => ({
  sanitizeMonitorInput: (s: string) => s.trim(),
  isValidKeyword: (k: string) => k.length > 0,
  sanitizeForLog: (s: string) => s,
}));

vi.mock("@/lib/posthog", () => ({
  captureEvent: vi.fn(),
}));

vi.mock("@/lib/error-logger", () => ({
  logError: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    delete: () => mockDbDelete(),
    update: () => mockDbUpdate(),
    transaction: (cb: (tx: unknown) => unknown) => mockDbTransaction(cb),
  },
  monitors: { id: "id", userId: "user_id" },
  users: { id: "id" },
}));

vi.mock("@/lib/db/schema", () => ({
  monitors: { id: "id", userId: "user_id" },
  users: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(),
  sql: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// --- Imports after mocks ---
import { POST as createMonitor } from "@/app/api/monitors/route";
import { GET as getMonitor, PATCH as patchMonitor, DELETE as deleteMonitor } from "@/app/api/monitors/[id]/route";
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
  mockGetUpgradePrompt.mockReturnValue({ description: "Upgrade", url: "/pricing" });
  // Default: verifyUserInDb returns the same userId
  mockVerifyUserInDb.mockImplementation((id: string) => Promise.resolve(id));
  // Default: getEffectiveUserId returns null (unauthenticated)
  mockGetEffectiveUserId.mockResolvedValue(null);
  // Default: db.update for isScanning flag
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
});

// ==========================================
// POST /api/monitors
// ==========================================
describe("POST /api/monitors", () => {
  const validBody = {
    name: "My Monitor",
    companyName: "Acme Inc",
    keywords: ["test", "acme"],
    platforms: ["reddit"],
  };

  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await createMonitor(makeRequest("POST", "/api/monitors", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await createMonitor(makeRequest("POST", "/api/monitors", validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 when name is missing", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1" });
    const res = await createMonitor(makeRequest("POST", "/api/monitors", { ...validBody, name: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when companyName is missing", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1" });
    const res = await createMonitor(makeRequest("POST", "/api/monitors", { ...validBody, companyName: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 400 when platforms is empty", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1" });
    const res = await createMonitor(makeRequest("POST", "/api/monitors", { ...validBody, platforms: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details).toBeDefined();
  });

  it("returns 403 when monitor limit reached", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    mockCheckKeywordsLimit.mockReturnValue({ allowed: true });
    mockFilterAllowedPlatforms.mockResolvedValue(["reddit"]);
    // Simulate transaction hitting the monitor limit. Route throws
    // "MONITOR_LIMIT:..." inside the transaction callback when count >= limit;
    // the catch block converts that to 403.
    mockDbTransaction.mockImplementation(async () => {
      throw new Error("MONITOR_LIMIT:You've reached your limit of 1 monitor. Upgrade to Pro for more.");
    });
    const res = await createMonitor(makeRequest("POST", "/api/monitors", validBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("reached your limit");
  });

  it("returns 201 when monitor is created successfully", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockCheckKeywordsLimit.mockReturnValue({ allowed: true });
    mockFilterAllowedPlatforms.mockResolvedValue(["reddit"]);
    // Transaction succeeds: select returns 0 rows (under limit), insert returns the new monitor.
    const createdMonitor = {
      id: "mon_1",
      name: "My Monitor",
      companyName: "Acme Inc",
      keywords: ["test", "acme"],
      platforms: ["reddit"],
      userId: "user_1",
    };
    mockDbTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
        insert: () => ({
          values: () => ({
            returning: vi.fn().mockResolvedValue([createdMonitor]),
          }),
        }),
      };
      return cb(tx);
    });

    const res = await createMonitor(makeRequest("POST", "/api/monitors", validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.monitor).toBeDefined();
    expect(json.monitor.id).toBe("mon_1");
  });

  it("returns 403 when no platforms are allowed for user plan", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    mockCanCreateMonitor.mockResolvedValue({ allowed: true });
    mockCheckKeywordsLimit.mockReturnValue({ allowed: true });
    mockFilterAllowedPlatforms.mockResolvedValue([]);
    const res = await createMonitor(makeRequest("POST", "/api/monitors", { ...validBody, platforms: ["devto"] }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("plan");
  });
});

// ==========================================
// GET /api/monitors/[id]
// ==========================================
describe("GET /api/monitors/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await getMonitor(
      makeRequest("GET", "/api/monitors/mon_1"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await getMonitor(
      makeRequest("GET", "/api/monitors/mon_1"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(429);
  });

  it("returns 404 when monitor not found", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findFirst.mockResolvedValue(null);
    const res = await getMonitor(
      makeRequest("GET", "/api/monitors/mon_1"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(404);
  });

  it("returns monitor when found and owned", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    const mockMonitor = { id: "mon_1", name: "Test", userId: "user_1" };
    mockDbQuery.monitors.findFirst.mockResolvedValue(mockMonitor);
    const res = await getMonitor(
      makeRequest("GET", "/api/monitors/mon_1"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.monitor).toBeDefined();
    expect(json.monitor.id).toBe("mon_1");
  });
});

// ==========================================
// PATCH /api/monitors/[id]
// ==========================================
describe("PATCH /api/monitors/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await patchMonitor(
      makeRequest("PATCH", "/api/monitors/mon_1", { name: "Updated" }),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when monitor not found (ownership check)", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findFirst.mockResolvedValue(null);
    const res = await patchMonitor(
      makeRequest("PATCH", "/api/monitors/mon_1", { name: "Updated" }),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid name", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findFirst.mockResolvedValue({ id: "mon_1", userId: "user_1", platforms: ["reddit"] });
    const res = await patchMonitor(
      makeRequest("PATCH", "/api/monitors/mon_1", { name: "" }),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(400);
  });

  it("updates monitor successfully", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findFirst.mockResolvedValue({ id: "mon_1", userId: "user_1", platforms: ["reddit"] });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "mon_1", name: "Updated", userId: "user_1" }]),
        }),
      }),
    });
    const res = await patchMonitor(
      makeRequest("PATCH", "/api/monitors/mon_1", { name: "Updated" }),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.monitor).toBeDefined();
  });
});

// ==========================================
// DELETE /api/monitors/[id]
// ==========================================
describe("DELETE /api/monitors/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await deleteMonitor(
      makeRequest("DELETE", "/api/monitors/mon_1"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when monitor not found", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findFirst.mockResolvedValue(null);
    const res = await deleteMonitor(
      makeRequest("DELETE", "/api/monitors/mon_1"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(404);
  });

  it("deletes monitor successfully", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockDbQuery.monitors.findFirst.mockResolvedValue({ id: "mon_1", userId: "user_1" });
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const res = await deleteMonitor(
      makeRequest("DELETE", "/api/monitors/mon_1"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
