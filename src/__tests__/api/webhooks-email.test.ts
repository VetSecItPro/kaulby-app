import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbUpdate } = vi.hoisted(() => {
  return { mockDbUpdate: vi.fn() };
});

vi.mock("@/lib/db", () => ({ db: { update: () => mockDbUpdate() } }));

import { POST } from "@/app/api/webhooks/email/route";
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
});

describe("POST /api/webhooks/email", () => {
  it("returns 200 for valid webhook", async () => {
    mockDbUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    const res = await POST(makeRequest("POST", "/api/webhooks/email", { type: "email.delivered" }));
    expect(res.status).toBe(200);
  });
});
