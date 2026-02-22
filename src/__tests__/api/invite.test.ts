import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCheckApiRateLimit, mockDbQuery } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { workspaceInvites: { findFirst: vi.fn() }, users: { findFirst: vi.fn() }, workspaces: { findFirst: vi.fn() } },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));
vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery, transaction: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db/schema", () => ({
  workspaceInvites: { token: "token", id: "id" },
  users: { id: "id" },
  workspaces: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendInviteAcceptedEmail: vi.fn(),
}));
vi.mock("@/lib/auth-utils", () => ({
  findUserWithFallback: vi.fn(),
}));

import { POST } from "@/app/api/invite/[token]/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

describe("POST /api/invite/[token]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest("POST", "/api/invite/token123"), { params: Promise.resolve({ token: "token123" }) });
    expect(res.status).toBe(401);
  });
});
