import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockCanTriggerManualScan,
  mockGetManualScanCooldown,
  mockInngestSend,
  mockDbQuery,
  mockDbUpdate,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockCanTriggerManualScan: vi.fn(),
    mockGetManualScanCooldown: vi.fn(),
    mockInngestSend: vi.fn(),
    mockDbQuery: {
      monitors: {
        findFirst: vi.fn(),
      },
    },
    mockDbUpdate: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("@/lib/limits", () => ({
  canTriggerManualScan: (...args: unknown[]) => mockCanTriggerManualScan(...args),
  getManualScanCooldown: (...args: unknown[]) => mockGetManualScanCooldown(...args),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: (...args: unknown[]) => mockInngestSend(...args) },
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    update: () => mockDbUpdate(),
  },
  monitors: { id: "id", userId: "user_id" },
}));

vi.mock("@/lib/db/schema", () => ({
  monitors: { id: "id", userId: "user_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// --- Imports ---
import { POST as triggerScan, GET as getScanStatus } from "@/app/api/monitors/[id]/scan/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method });
}

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

// ==========================================
// POST /api/monitors/[id]/scan
// ==========================================
describe("POST /api/monitors/[id]/scan", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await triggerScan(
      makeRequest("POST", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await triggerScan(
      makeRequest("POST", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(429);
  });

  it("returns 404 when monitor not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.monitors.findFirst.mockResolvedValue(null);
    const res = await triggerScan(
      makeRequest("POST", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when monitor is inactive", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.monitors.findFirst.mockResolvedValue({
      id: "mon_1",
      userId: "user_1",
      isActive: false,
      isScanning: false,
    });
    const res = await triggerScan(
      makeRequest("POST", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("inactive");
  });

  it("returns 409 when scan already in progress", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.monitors.findFirst.mockResolvedValue({
      id: "mon_1",
      userId: "user_1",
      isActive: true,
      isScanning: true,
    });
    const res = await triggerScan(
      makeRequest("POST", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.isScanning).toBe(true);
  });

  it("returns 429 when cooldown not met", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.monitors.findFirst.mockResolvedValue({
      id: "mon_1",
      userId: "user_1",
      isActive: true,
      isScanning: false,
      lastManualScanAt: new Date(),
    });
    mockCanTriggerManualScan.mockResolvedValue({
      canScan: false,
      reason: "Cooldown active",
      cooldownRemaining: 3600,
      nextScanAt: new Date(Date.now() + 3600000),
    });
    mockGetManualScanCooldown.mockResolvedValue(4);
    const res = await triggerScan(
      makeRequest("POST", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.cooldownRemaining).toBeDefined();
  });

  it("triggers scan successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.monitors.findFirst.mockResolvedValue({
      id: "mon_1",
      userId: "user_1",
      isActive: true,
      isScanning: false,
      lastManualScanAt: null,
    });
    mockCanTriggerManualScan.mockResolvedValue({ canScan: true });
    mockInngestSend.mockResolvedValue(undefined);
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const res = await triggerScan(
      makeRequest("POST", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Scan started");
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "monitor/scan-now",
      data: { monitorId: "mon_1", userId: "user_1" },
    });
  });
});

// ==========================================
// GET /api/monitors/[id]/scan
// ==========================================
describe("GET /api/monitors/[id]/scan", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await getScanStatus(
      makeRequest("GET", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when monitor not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.monitors.findFirst.mockResolvedValue(null);
    const res = await getScanStatus(
      makeRequest("GET", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(404);
  });

  it("returns scan status for owned monitor", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockDbQuery.monitors.findFirst.mockResolvedValue({
      id: "mon_1",
      isScanning: false,
      lastManualScanAt: null,
      lastCheckedAt: new Date("2024-01-01"),
      newMatchCount: 5,
    });
    mockCanTriggerManualScan.mockResolvedValue({ canScan: true, cooldownRemaining: 0, nextScanAt: null });
    mockGetManualScanCooldown.mockResolvedValue(4);

    const res = await getScanStatus(
      makeRequest("GET", "/api/monitors/mon_1/scan"),
      makeRouteContext("mon_1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isScanning).toBe(false);
    expect(json.canScan).toBe(true);
    expect(json.newMatchCount).toBe(5);
  });
});
