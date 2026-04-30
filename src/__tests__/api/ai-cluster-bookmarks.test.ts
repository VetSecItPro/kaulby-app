import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockGetEffectiveUserId,
  mockGetUserPlan,
  mockCheckAllRateLimits,
  mockCheckTokenBudget,
  mockSanitizeInput,
  mockJsonCompletion,
  mockFlushAI,
  mockLogAiCall,
  mockBookmarksSelect,
  mockResultsSelect,
} = vi.hoisted(() => {
  return {
    mockGetEffectiveUserId: vi.fn(),
    mockGetUserPlan: vi.fn(),
    mockCheckAllRateLimits: vi.fn(),
    mockCheckTokenBudget: vi.fn(),
    mockSanitizeInput: vi.fn((input: string) => input),
    mockJsonCompletion: vi.fn(),
    mockFlushAI: vi.fn(),
    mockLogAiCall: vi.fn(),
    mockBookmarksSelect: vi.fn(),
    mockResultsSelect: vi.fn(),
  };
});

vi.mock("@/lib/dev-auth", () => ({
  getEffectiveUserId: () => mockGetEffectiveUserId(),
}));

vi.mock("@/lib/limits", () => ({
  getUserPlan: (...args: unknown[]) => mockGetUserPlan(...args),
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  checkAllRateLimits: (...args: unknown[]) => mockCheckAllRateLimits(...args),
  checkTokenBudget: (...args: unknown[]) => mockCheckTokenBudget(...args),
  sanitizeInput: (input: string) => mockSanitizeInput(input),
}));

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
  flushAI: () => mockFlushAI(),
  MODELS: { primary: "primary", premium: "premium" },
}));

vi.mock("@/lib/ai/log", () => ({
  logAiCall: (...args: unknown[]) => mockLogAiCall(...args),
}));

// Drizzle's `db.select().from().where().limit()` chain — return a thenable
// shaped like the route expects. The route calls bookmarks first, results
// second; we route by call order.
let dbCallIndex = 0;
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            dbCallIndex += 1;
            return Promise.resolve(dbCallIndex === 1 ? mockBookmarksSelect() : mockResultsSelect());
          },
          // For the second call (results) the route doesn't chain .limit().
          then: (resolve: (v: unknown) => unknown) => {
            dbCallIndex += 1;
            const out = dbCallIndex === 1 ? mockBookmarksSelect() : mockResultsSelect();
            return Promise.resolve(out).then(resolve);
          },
        }),
      }),
    }),
  },
}));

// --- Imports ---
import { POST } from "@/app/api/ai/cluster-bookmarks/route";

beforeEach(() => {
  vi.clearAllMocks();
  dbCallIndex = 0;
  mockCheckAllRateLimits.mockResolvedValue({ allowed: true });
  mockCheckTokenBudget.mockResolvedValue({ allowed: true });
  mockFlushAI.mockResolvedValue(undefined);
  mockLogAiCall.mockResolvedValue(undefined);
});

function makeRow(overrides: Partial<{
  id: string;
  title: string;
  platform: string;
  sentiment: string | null;
  conversationCategory: string | null;
  leadScore: number | null;
}> = {}) {
  return {
    id: overrides.id ?? "r_x",
    title: overrides.title ?? "title",
    platform: overrides.platform ?? "reddit",
    sentiment: overrides.sentiment ?? null,
    conversationCategory: overrides.conversationCategory ?? null,
    leadScore: overrides.leadScore ?? null,
  };
}

describe("POST /api/ai/cluster-bookmarks", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/ai/cluster-bookmarks", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is on free", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockGetUserPlan.mockResolvedValue("free");
    const res = await POST(new Request("http://localhost/api/ai/cluster-bookmarks", { method: "POST" }));
    expect(res.status).toBe(403);
  });

  it("returns empty clusters when fewer than 4 bookmarks", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockGetUserPlan.mockResolvedValue("solo");
    mockBookmarksSelect.mockReturnValue([{ resultId: "r1" }, { resultId: "r2" }]);

    const res = await POST(new Request("http://localhost/api/ai/cluster-bookmarks", { method: "POST" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clusters).toEqual([]);
    expect(json.totalBookmarks).toBe(2);
    expect(mockJsonCompletion).not.toHaveBeenCalled();
  });

  it("buckets by metadata and only calls AI once for labels", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockGetUserPlan.mockResolvedValue("solo");

    mockBookmarksSelect.mockReturnValue([
      { resultId: "r1" }, { resultId: "r2" }, { resultId: "r3" },
      { resultId: "r4" }, { resultId: "r5" }, { resultId: "r6" },
    ]);

    mockResultsSelect.mockReturnValue([
      // 2 high-intent
      makeRow({ id: "r1", leadScore: 80 }),
      makeRow({ id: "r2", leadScore: 90 }),
      // 2 pain points
      makeRow({ id: "r3", sentiment: "negative" }),
      makeRow({ id: "r4", conversationCategory: "pain_point" }),
      // 2 solution seekers
      makeRow({ id: "r5", conversationCategory: "solution_request" }),
      makeRow({ id: "r6", conversationCategory: "solution_request" }),
    ]);

    mockJsonCompletion.mockResolvedValue({
      data: {
        labels: {
          high_intent: { label: "Hot leads", description: "Score 75+" },
          pain_points: { label: "Complaints", description: "Negative sentiment" },
          solution_seekers: { label: "Asking around", description: "Looking for alternatives" },
        },
      },
      meta: { model: "primary", promptTokens: 30, completionTokens: 20, cost: 0, latencyMs: 200 },
    });

    const res = await POST(new Request("http://localhost/api/ai/cluster-bookmarks", { method: "POST" }));
    expect(res.status).toBe(200);
    const json = await res.json();

    // Exactly ONE AI call (labels) — old route called per-bookmark group.
    expect(mockJsonCompletion).toHaveBeenCalledTimes(1);

    // 3 buckets, each with at least 2 IDs.
    expect(json.clusters).toHaveLength(3);
    const labels = json.clusters.map((c: { label: string }) => c.label);
    expect(labels).toContain("Hot leads");
    expect(labels).toContain("Complaints");
    expect(labels).toContain("Asking around");

    // High-intent bucket should hold r1 and r2.
    const highIntent = json.clusters.find((c: { label: string }) => c.label === "Hot leads");
    expect(highIntent.resultIds.sort()).toEqual(["r1", "r2"]);
  });

  it("falls back to default labels when AI labeler fails", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockGetUserPlan.mockResolvedValue("solo");

    mockBookmarksSelect.mockReturnValue([
      { resultId: "r1" }, { resultId: "r2" }, { resultId: "r3" }, { resultId: "r4" },
    ]);
    mockResultsSelect.mockReturnValue([
      makeRow({ id: "r1", leadScore: 80 }),
      makeRow({ id: "r2", leadScore: 85 }),
      makeRow({ id: "r3", sentiment: "negative" }),
      makeRow({ id: "r4", conversationCategory: "pain_point" }),
    ]);

    mockJsonCompletion.mockRejectedValue(new Error("model timeout"));

    const res = await POST(new Request("http://localhost/api/ai/cluster-bookmarks", { method: "POST" }));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.clusters).toHaveLength(2);
    const labels = json.clusters.map((c: { label: string }) => c.label);
    expect(labels).toContain("High-intent buyers");
    expect(labels).toContain("Pain points");
  });

  it("merges singletons into general bucket so the UI never starves", async () => {
    mockGetEffectiveUserId.mockResolvedValue("user_1");
    mockGetUserPlan.mockResolvedValue("solo");

    mockBookmarksSelect.mockReturnValue([
      { resultId: "r1" }, { resultId: "r2" }, { resultId: "r3" }, { resultId: "r4" },
    ]);
    // Each bookmark in a different category — no bucket reaches 2 except via merge.
    mockResultsSelect.mockReturnValue([
      makeRow({ id: "r1", leadScore: 80 }),
      makeRow({ id: "r2", conversationCategory: "solution_request" }),
      makeRow({ id: "r3", conversationCategory: "money_talk" }),
      makeRow({ id: "r4", conversationCategory: "hot_discussion" }),
    ]);

    mockJsonCompletion.mockResolvedValue({
      data: { labels: {} },
      meta: { model: "primary", promptTokens: 10, completionTokens: 5, cost: 0, latencyMs: 50 },
    });

    const res = await POST(new Request("http://localhost/api/ai/cluster-bookmarks", { method: "POST" }));
    expect(res.status).toBe(200);
    const json = await res.json();

    // All 4 singletons should merge into general (>=2 items required per cluster).
    expect(json.clusters).toHaveLength(1);
    expect(json.clusters[0].resultIds).toHaveLength(4);
  });
});
