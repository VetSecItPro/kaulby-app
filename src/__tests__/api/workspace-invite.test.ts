import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery, mockDbInsert, mockDbDelete } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: {
      users: { findFirst: vi.fn() },
      workspaces: { findFirst: vi.fn() },
      workspaceInvites: { findFirst: vi.fn(), findMany: vi.fn() }
    },
    mockDbInsert: vi.fn(() => ({ values: vi.fn().mockReturnThis(), returning: vi.fn(() => [{ id: "inv_1", email: "test@test.com" }]) })),
    mockDbDelete: vi.fn(() => ({ where: vi.fn() })),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
  parseJsonBody: async (req: Request) => req.json(),
  BodyTooLargeError: class BodyTooLargeError extends Error {},
}));
vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    insert: () => mockDbInsert(),
    delete: () => mockDbDelete()
  },
}));
vi.mock("@/lib/db/schema", () => ({
  workspaces: {},
  workspaceInvites: {},
  users: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendWorkspaceInviteEmail: vi.fn(),
}));
vi.mock("@/lib/auth-utils", () => ({
  findUserWithFallback: vi.fn((userId: string) => ({ id: userId, workspaceId: "ws_1", workspaceRole: "owner", email: "owner@test.com" })),
}));
vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

import { POST } from "@/app/api/workspace/invite/route";
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
  mockDbQuery.workspaces.findFirst.mockResolvedValue({ id: "ws_1", name: "Test Workspace", seatCount: 1, seatLimit: 10 });
});

describe("POST /api/workspace/invite", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/workspace/invite", { email: "test@test.com" }));
    expect(res.status).toBe(401);
  });
});
