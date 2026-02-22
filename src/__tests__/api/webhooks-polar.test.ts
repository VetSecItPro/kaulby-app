import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbQuery, mockDbUpdate } = vi.hoisted(() => {
  return {
    mockDbQuery: { users: { findFirst: vi.fn() } },
    mockDbUpdate: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn(() => [{}]) })),
  };
});

// Mock environment variable
vi.stubEnv("POLAR_WEBHOOK_SECRET", "test-webhook-secret");

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    update: () => mockDbUpdate(),
  },
  users: {},
}));

vi.mock("@/lib/db/schema", () => ({
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(),
  relations: vi.fn(),
}));

vi.mock("@/lib/polar", () => ({
  getPlanFromProductId: vi.fn(() => "pro"),
}));

vi.mock("@/lib/email", () => ({
  upsertContact: vi.fn(),
  sendSubscriptionEmail: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  captureEvent: vi.fn(),
}));

vi.mock("@/lib/day-pass", () => ({
  activateDayPass: vi.fn(() => ({ expiresAt: new Date(), purchaseCount: 1 })),
}));

import { POST } from "@/app/api/webhooks/polar/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  const init: { method: string; body?: string; headers?: Record<string, string> } = {
    method,
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  if (headers) {
    init.headers = headers;
  }
  return new NextRequest(`http://localhost${url}`, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", email: "test@test.com" });
});

describe("POST /api/webhooks/polar", () => {
  it("returns 400 when headers are missing", async () => {
    // Request without signature headers
    const req = makeRequest("POST", "/api/webhooks/polar", { type: "subscription.created" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
