import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbUpdate } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { users: { findFirst: vi.fn() } },
    mockDbUpdate: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery, update: () => mockDbUpdate() },
}));
vi.mock("@/lib/db/schema", () => ({
  users: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { PATCH as PATCH_EMAIL_PREFS } from "@/app/api/user/email-preferences/route";
import { PATCH as PATCH_TIMEZONE } from "@/app/api/user/timezone/route";
import { POST as POST_ONBOARDING } from "@/app/api/user/onboarding/route";
import { POST as POST_DELETION } from "@/app/api/user/request-deletion/route";
import { NextRequest } from "next/server";

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
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

describe("PATCH /api/user/email-preferences", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH_EMAIL_PREFS(makeRequest("PATCH", "/api/user/email-preferences", {}));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/user/timezone", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await PATCH_TIMEZONE(makeRequest("PATCH", "/api/user/timezone", { timezone: "UTC" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/user/onboarding", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST_ONBOARDING(makeRequest("POST", "/api/user/onboarding", {}));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/user/request-deletion", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST_DELETION();
    expect(res.status).toBe(401);
  });
});
