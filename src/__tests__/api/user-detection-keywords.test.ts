import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (available inside vi.mock factories) ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockGetUserPlan,
  mockDbQuery,
  mockDbInsertValues,
  mockDbInsert,
  mockDbUpdateWhere,
  mockDbUpdateSet,
  mockDbUpdate,
} = vi.hoisted(() => {
  const mockDbQuery = {
    userDetectionKeywords: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  const mockDbInsertValues = vi.fn();
  const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });
  const mockDbUpdateWhere = vi.fn();
  const mockDbUpdateSet = vi.fn().mockReturnValue({ where: mockDbUpdateWhere });
  const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockGetUserPlan: vi.fn(),
    mockDbQuery,
    mockDbInsertValues,
    mockDbInsert,
    mockDbUpdateWhere,
    mockDbUpdateSet,
    mockDbUpdate,
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

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => args,
  and: (...args: unknown[]) => args,
}));

// --- Import after mocks ---
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

// ==========================================
// GET /api/user/detection-keywords
// ==========================================
describe("GET /api/user/detection-keywords", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    const res = await GET();
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns 403 when on free plan (unlimitedAiAnalysis = false)", async () => {
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
    expect(json.keywords.length).toBe(5); // 5 detection categories
    for (const kw of json.keywords) {
      expect(kw.isDefault).toBe(true);
      expect(kw.id).toBeNull();
      expect(kw.isActive).toBe(true);
      expect(kw.keywords.length).toBeGreaterThan(0);
    }
  });

  it("returns user's custom keywords merged with missing categories", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    // User only has pain_point customized
    mockDbQuery.userDetectionKeywords.findMany.mockResolvedValue([
      { id: "dk_1", category: "pain_point", keywords: ["broken", "buggy"], isActive: true },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    // 1 custom + 4 default categories = 5 total
    expect(json.keywords.length).toBe(5);

    const painPoint = json.keywords.find((k: { category: string }) => k.category === "pain_point");
    expect(painPoint.isDefault).toBe(false);
    expect(painPoint.id).toBe("dk_1");
    expect(painPoint.keywords).toEqual(["broken", "buggy"]);

    // The other 4 should be defaults
    const defaults = json.keywords.filter((k: { isDefault: boolean }) => k.isDefault);
    expect(defaults.length).toBe(4);
    for (const d of defaults) {
      expect(d.id).toBeNull();
      expect(d.isActive).toBe(true);
    }
  });

  it("throws on unexpected error (no try-catch in route)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findMany.mockRejectedValue(new Error("DB connection failed"));

    await expect(GET()).rejects.toThrow("DB connection failed");
  });
});

// ==========================================
// PUT /api/user/detection-keywords
// ==========================================
describe("PUT /api/user/detection-keywords", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: ["test"] }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });
    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: ["test"] }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("returns 403 when on free plan", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: ["test"] }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Pro or Team plan");
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

  it("updates existing keywords for a category", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findFirst.mockResolvedValue({
      id: "dk_1",
      userId: "user_1",
      category: "pain_point",
      keywords: ["old"],
      isActive: true,
    });

    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords: ["broken", "crashing"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.category).toBe("pain_point");
    expect(json.keywords).toEqual(["broken", "crashing"]);
    // Verify update was called (not insert)
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockDbUpdateSet).toHaveBeenCalled();
  });

  it("creates new keywords for a category", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findFirst.mockResolvedValue(null);

    const res = await PUT(makeRequest("PUT", { category: "money_talk", keywords: ["expensive", "pricing"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.category).toBe("money_talk");
    expect(json.keywords).toEqual(["expensive", "pricing"]);
    // Verify insert was called (not update)
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockDbInsertValues).toHaveBeenCalled();
  });

  it("sanitizes keywords (trim, lowercase, deduplicate, max 50)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findFirst.mockResolvedValue(null);

    // Build array: duplicates, whitespace, uppercase, empty strings, and more than 50
    const keywords = [
      "  Broken  ",
      "BROKEN",
      "broken",
      "  ",
      "",
      "Crashing",
      ...Array.from({ length: 55 }, (_, i) => `keyword${i}`),
    ];

    const res = await PUT(makeRequest("PUT", { category: "pain_point", keywords }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    // "broken" appears 3 times (after trim/lowercase) -> deduplicated to 1
    // empty/whitespace filtered out
    // "crashing" + 55 keyword{i} + "broken" = 57 unique, but max 50
    expect(json.keywords.length).toBeLessThanOrEqual(50);
    // Verify all lowercase
    for (const kw of json.keywords) {
      expect(kw).toBe(kw.toLowerCase());
      expect(kw).toBe(kw.trim());
      expect(kw.length).toBeGreaterThan(0);
    }
    // No duplicates
    expect(new Set(json.keywords).size).toBe(json.keywords.length);
  });
});

// ==========================================
// POST /api/user/detection-keywords
// ==========================================
describe("POST /api/user/detection-keywords", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 45 });
    const res = await POST();
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
  });

  it("returns 403 when on free plan", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    const res = await POST();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Pro or Team plan");
  });

  it("returns existing count when already seeded", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findMany.mockResolvedValue([
      { id: "dk_1" },
      { id: "dk_2" },
      { id: "dk_3" },
    ]);

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe("Already initialized");
    expect(json.count).toBe(3);
    // Should NOT have called insert
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("seeds all categories with defaults", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.userDetectionKeywords.findMany.mockResolvedValue([]);

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(5); // 5 detection categories
    // Verify insert was called
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockDbInsertValues).toHaveBeenCalled();
  });
});
