import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockCurrentUser } = vi.hoisted(() => {
  return { mockAuth: vi.fn(), mockCurrentUser: vi.fn() };
});

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));

import { POST as POST_CHECKOUT } from "@/app/api/polar/checkout/route";
import { POST as POST_DAY_PASS } from "@/app/api/polar/day-pass/route";
import { POST as POST_PORTAL } from "@/app/api/polar/portal/route";
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
  mockAuth.mockResolvedValue({ userId: "user_1" });
  mockCurrentUser.mockResolvedValue({ id: "user_1", emailAddresses: [{ emailAddress: "test@example.com" }] });
});

describe("POST /api/polar/checkout", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    mockCurrentUser.mockResolvedValue(null);
    const res = await POST_CHECKOUT(makeRequest("POST", "/api/polar/checkout", { tier: "pro" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/polar/day-pass", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    mockCurrentUser.mockResolvedValue(null);
    const res = await POST_DAY_PASS();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/polar/portal", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    mockCurrentUser.mockResolvedValue(null);
    const res = await POST_PORTAL();
    expect(res.status).toBe(401);
  });
});
