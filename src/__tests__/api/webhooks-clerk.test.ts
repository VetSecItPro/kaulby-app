import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockWebhookVerify, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete, mockHeadersGet } = vi.hoisted(() => {
  return {
    mockWebhookVerify: vi.fn(),
    mockDbQuery: { users: { findFirst: vi.fn() } },
    mockDbInsert: vi.fn(() => ({ values: vi.fn() })),
    mockDbUpdate: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn() })),
    mockDbDelete: vi.fn(() => ({ where: vi.fn() })),
    mockHeadersGet: vi.fn(),
  };
});

// Mock environment variable
vi.stubEnv("CLERK_WEBHOOK_SECRET", "test-webhook-secret");

vi.mock("svix", () => ({
  Webhook: class {
    constructor() {}
    verify = mockWebhookVerify;
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: mockHeadersGet,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    update: () => mockDbUpdate(),
    delete: () => mockDbDelete(),
  },
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  upsertContact: vi.fn(),
  sendWelcomeEmail: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  identifyUser: vi.fn(),
}));

import { POST } from "@/app/api/webhooks/clerk/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: { method: string; body?: string } = {
    method,
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(`http://localhost${url}`, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default headers to have all required headers
  mockHeadersGet.mockImplementation((key: string) => {
    const headers: Record<string, string> = {
      "svix-id": "test-id",
      "svix-timestamp": "123456",
      "svix-signature": "test-signature",
    };
    return headers[key] || null;
  });
});

describe("POST /api/webhooks/clerk", () => {
  it("returns 400 when headers are missing", async () => {
    // Mock headers to return null for required headers
    mockHeadersGet.mockReturnValue(null);

    const req = makeRequest("POST", "/api/webhooks/clerk", { type: "user.created" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
