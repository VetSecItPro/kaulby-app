import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockGetUserPlan,
  mockCheckAllRateLimits,
  mockCheckTokenBudget,
  mockValidateInput,
  mockSanitizeInput,
  mockJsonCompletion,
  mockFlushAI,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockGetUserPlan: vi.fn(),
    mockCheckAllRateLimits: vi.fn(),
    mockCheckTokenBudget: vi.fn(),
    mockValidateInput: vi.fn(),
    mockSanitizeInput: vi.fn((input: string) => input),
    mockJsonCompletion: vi.fn(),
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
}));

vi.mock("@/lib/ai/openrouter", () => ({
  jsonCompletion: (...args: unknown[]) => mockJsonCompletion(...args),
  flushAI: () => mockFlushAI(),
  MODELS: { primary: "primary", premium: "premium" },
}));

// --- Imports ---
import { POST } from "@/app/api/ai/suggest-reply/route";
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
  mockFlushAI.mockResolvedValue(undefined);
});

// ==========================================
// POST /api/ai/suggest-reply
// ==========================================
describe("POST /api/ai/suggest-reply", () => {
  const validBody = {
    resultId: "res_1",
    title: "Looking for a good project management tool",
    content: "Any recommendations?",
    platform: "reddit",
  };

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/ai/suggest-reply", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not pro or enterprise", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("free");
    const res = await POST(makeRequest("POST", "/api/ai/suggest-reply", validBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Pro");
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockCheckAllRateLimits.mockResolvedValue({ allowed: false, reason: "Rate limit exceeded", retryAfter: 30 });
    const res = await POST(makeRequest("POST", "/api/ai/suggest-reply", validBody));
    expect(res.status).toBe(429);
  });

  it("returns 429 when token budget exceeded", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockCheckTokenBudget.mockResolvedValue({ allowed: false, used: 10000, limit: 10000, remaining: 0 });
    const res = await POST(makeRequest("POST", "/api/ai/suggest-reply", validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 when title is invalid", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockValidateInput.mockReturnValue({ valid: false, reason: "Invalid title" });
    const res = await POST(makeRequest("POST", "/api/ai/suggest-reply", { ...validBody, title: "" }));
    expect(res.status).toBe(400);
  });

  it("generates reply suggestions successfully", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockGetUserPlan.mockResolvedValue("pro");
    mockJsonCompletion.mockResolvedValue({
      data: {
        suggestions: [
          { text: "Have you tried Asana?", tone: "helpful", confidence: 0.9 },
          { text: "I'd recommend checking out Monday.com", tone: "casual", confidence: 0.85 },
          { text: "Jira works well for software teams", tone: "professional", confidence: 0.8 },
        ],
      },
      meta: {
        model: "primary",
        promptTokens: 80,
        completionTokens: 60,
      },
    });

    const res = await POST(makeRequest("POST", "/api/ai/suggest-reply", validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.suggestions).toHaveLength(3);
    expect(json.suggestions[0].text).toBe("Have you tried Asana?");
    expect(json.meta.tokensUsed).toBe(140);
  });
});
