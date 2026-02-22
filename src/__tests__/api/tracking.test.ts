import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbQuery, mockDbInsert } = vi.hoisted(() => {
  return {
    mockDbQuery: { emailEvents: { findFirst: vi.fn() } },
    mockDbInsert: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: { query: mockDbQuery, insert: () => mockDbInsert() },
}));
vi.mock("@/lib/db/schema", () => ({
  emailEvents: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  gt: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(),
}));
vi.mock("@/lib/security", () => ({
  sanitizeUrl: vi.fn((url) => url),
  isValidUuid: vi.fn(() => true),
}));

import { GET as GET_CLICK } from "@/app/api/track/click/route";
import { GET as GET_OPEN } from "@/app/api/track/open/route";
import { NextRequest } from "next/server";

function makeRequest(method: string, url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
});

describe("GET /api/track/click", () => {
  it("redirects to dashboard when URL is missing", async () => {
    const res = await GET_CLICK(makeRequest("GET", "/api/track/click"));
    expect(res.status).toBe(307); // Redirect status
  });
});

describe("GET /api/track/open", () => {
  it("returns tracking pixel even when params are missing", async () => {
    const res = await GET_OPEN(makeRequest("GET", "/api/track/open"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/gif");
  });
});
