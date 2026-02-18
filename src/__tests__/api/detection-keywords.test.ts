import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (available inside vi.mock factories) ---

const { mockAuth, mockCheckApiRateLimit, mockGetUserPlan, mockDbQuery, mockDbInsert, mockDbUpdate } = vi.hoisted(() => {
  const mockDbQuery = {
    userDetectionKeywords: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockGetUserPlan: vi.fn(),
    mockDbQuery,
    mockDbInsert: vi.fn().mockReturnValue({ values: vi.fn() }),
    mockDbUpdate: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    }),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("@/lib/limits", () => ({
  getUserPlan: (...args: unknown[]) => mockGetUserPlan(...args),
}));

vi.mock("@/lib/plans", () => ({
  getPlanLimits: (plan: string) => ({
    aiFeatures: { unlimitedAiAnalysis: plan === "pro" || plan === "enterprise" },
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    update: () => mockDbUpdate(),
  },
  userDetectionKeywords: { id: "id", userId: "user_id", category: "category" },
}));

// Import after mocks
import { GET, PUT, POST } from "@/app/api/user/detection-keywords/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(method: string, body?: unknown): NextRequest {
  const url = "http://localhost/api/user/detection-keywords";
  const init: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/user/detection-keywords", () => {
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

  it("returns 403 for free tier users", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Pro or Team plan");
  });

  it("returns default keywords when user has none", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keywords).toBeDefined();
    expect(json.keywords.length).toBeGreaterThan(0);
    expect(json.keywords[0].isDefault).toBe(true);
  });

  it("returns existing keywords merged with new categories", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findMany.mockResolvedValue([
      { id: "dk_1", category: "pain_point", keywords: ["broken"], isActive: true },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keywords.length).toBeGreaterThan(1);
    const painPoint = json.keywords.find((k: { category: string }) => k.category === "pain_point");
    expect(painPoint.isDefault).toBe(false);
    expect(painPoint.keywords).toEqual(["broken"]);
  });
});

describe("PUT /api/user/detection-keywords", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: ["test"] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid category", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    const res = await PUT(makeRequest("PUT", { category: "invalid_cat", keywords: ["test"] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid category");
  });

  it("returns 400 when keywords is not an array", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: "not-array" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Keywords must be an array");
  });

  it("returns 403 for free tier users", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: ["test"] }));
    expect(res.status).toBe(403);
  });

  it("returns success for valid input with dedup/trim/lowercase", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findFirst.mockResolvedValue(null);

    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: ["  Broken  ", "BROKEN", "crashing"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.keywords).toEqual(["broken", "crashing"]);
  });
});

describe("POST /api/user/detection-keywords", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 403 for free tier users", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("returns message when already seeded", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findMany.mockResolvedValue([{ id: "dk_1" }]);

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe("Already initialized");
  });

  it("seeds all categories for first-time setup", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findMany.mockResolvedValue([]);

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(5);
  });
});
