import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbUpdate } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { users: { findFirst: vi.fn() } },
    mockDbUpdate: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn() })),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({ checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args) }));
vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    update: () => mockDbUpdate()
  },
  users: {}
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/integrations/hubspot", () => ({
  isHubSpotConfigured: vi.fn(() => true),
  getAuthorizationUrl: vi.fn((state: string) => `https://app.hubspot.com/oauth/authorize?state=${state}`),
}));
vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "test-nanoid") }));

import { POST, DELETE } from "@/app/api/integrations/hubspot/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockDbQuery.users.findFirst.mockResolvedValue({ id: "user_1", integrations: {} });
});

describe("POST /api/integrations/hubspot", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST();
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/integrations/hubspot", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE();
    expect(res.status).toBe(401);
  });
});
