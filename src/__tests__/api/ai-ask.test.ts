import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockGetUserPlan,
  mockCheckAllRateLimits,
  mockCheckTokenBudget,
  mockValidateInput,
  mockSanitizeInput,
  mockGetCachedAnswer,
  mockCacheAnswer,
  mockDbQuery,
  mockCompletion,
  mockFlushAI,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockGetUserPlan: vi.fn(),
    mockCheckAllRateLimits: vi.fn(),
    mockCheckTokenBudget: vi.fn(),
    mockValidateInput: vi.fn(),
    mockSanitizeInput: vi.fn((input: string) => input),
    mockGetCachedAnswer: vi.fn(),
    mockCacheAnswer: vi.fn(),
    mockDbQuery: {
      monitors: {
        findMany: vi.fn(),
      },
      results: {
        findMany: vi.fn(),
      },
    },
    mockCompletion: vi.fn(),
    mockFlushAI: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/limits", () => ({
  getUserPlan: (...args: unknown[]) => mockGetUserPlan(...args),
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  checkAllRateLimits: (...args: unknown[]) => mockCheckAllRateLimits(...args),
  checkTokenBudget: (...args: unknown[]) => mockCheckTokenBudget(...args),
  validateInput: (...args: unknown[]) => mockValidateInput(...args),
  sanitizeInput: (input: string) => mockSanitizeInput(input),
  getCachedAnswer: (...args: unknown[]) => mockGetCachedAnswer(...args),
  cacheAnswer: (...args: unknown[]) => mockCacheAnswer(...args),
}));

vi.mock("@/lib/ai/openrouter", () => ({
  completion: (...args: unknown[]) => mockCompletion(...args),
  flushAI: () => mockFlushAI(),
  MODELS: { primary: "primary", premium: "premium" },
}));

vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery },
  results: { monitorId: "monitor_id", createdAt: "created_at", isHidden: "is_hidden", engagementScore: "engagement_score" },
  monitors: { userId: "user_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  gte: vi.fn(),
}));

// --- Imports ---
import { POST } from "@/app/api/ai/ask/route";
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
  mockValidateInput.mockReturnValue({ valid: true });
  mockCheckAllRateLimits.mockResolvedValue({ allowed: true });
  mockCheckTokenBudget.mockResolvedValue({ allowed: true, used: 100, limit: 10000, remaining: 9900 });
  mockGetCachedAnswer.mockReturnValue(null);
  mockFlushAI.mockResolvedValue(undefined);
});

// ==========================================
// POST /api/ai/ask
// ==========================================
describe("POST /api/ai/ask", () => {
  const validBody = {
    question: "What are customers saying about our product?",
    monitorIds: ["mon_1"],
  };

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/ai/ask", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not pro or enterprise", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    const res = await POST(makeRequest("POST", "/api/ai/ask", validBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Pro");
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockCheckAllRateLimits.mockResolvedValue({ allowed: false, reason: "Rate limit exceeded", retryAfter: 30 });
    const res = await POST(makeRequest("POST", "/api/ai/ask", validBody));
    expect(res.status).toBe(429);
  });

  it("returns 429 when token budget exceeded", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockCheckTokenBudget.mockResolvedValue({ allowed: false, used: 10000, limit: 10000, remaining: 0 });
    const res = await POST(makeRequest("POST", "/api/ai/ask", validBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("budget");
  });

  it("returns 400 when question is invalid", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockValidateInput.mockReturnValue({ valid: false, reason: "Question is too short" });
    const res = await POST(makeRequest("POST", "/api/ai/ask", { question: "hi" }));
    expect(res.status).toBe(400);
  });

  it("returns cached answer when available", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockGetCachedAnswer.mockReturnValue({
      answer: "Cached answer",
      citations: [],
    });
    const res = await POST(makeRequest("POST", "/api/ai/ask", validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toBe("Cached answer");
    expect(json.meta.cached).toBe(true);
  });

  it("generates AI response successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockDbQuery.monitors.findMany.mockResolvedValue([
      { id: "mon_1", name: "Test Monitor", companyName: "Test Company" },
    ]);
    mockDbQuery.results.findMany.mockResolvedValue([
      {
        id: "res_1",
        title: "Test Result",
        content: "Test content",
        platform: "reddit",
        sourceUrl: "https://reddit.com/1",
        sentiment: "positive",
        conversationCategory: "pain_point",
        aiSummary: "Summary",
        engagementScore: 75,
        leadScore: 60,
        postedAt: new Date(),
        monitorId: "mon_1",
      },
    ]);
    mockCompletion.mockResolvedValue({
      content: "Here's what I found [1]",
      model: "primary",
      promptTokens: 100,
      completionTokens: 50,
    });

    const res = await POST(makeRequest("POST", "/api/ai/ask", validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toBe("Here's what I found [1]");
    expect(json.citations).toBeDefined();
    expect(json.meta.tokensUsed).toBe(150);
  });
});
