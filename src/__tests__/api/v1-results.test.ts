import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { mockWithApiAuth, mockDbSelect } = vi.hoisted(() => {
  return {
    mockWithApiAuth: vi.fn(),
    mockDbSelect: vi.fn(),
  };
});

vi.mock("@/lib/api-auth", () => ({
  withApiAuth: (req: NextRequest, handler: (userId: string) => Promise<NextResponse>) => mockWithApiAuth(req, handler),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockDbSelect(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  monitors: {},
  results: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  count: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
}));

import { GET } from "@/app/api/v1/results/route";

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/results", () => {
  it("returns 401 when API key is invalid", async () => {
    // Mock withApiAuth to return 401 (not call handler)
    mockWithApiAuth.mockResolvedValue(
      NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    );

    const res = await GET(makeRequest("GET", "/api/v1/results"));
    expect(res.status).toBe(401);
  });
});
