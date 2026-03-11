import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockAuth,
  mockCheckApiRateLimit,
  mockDbQuery,
  mockDbDelete,
} = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockDbQuery: { bookmarks: { findFirst: vi.fn() } },
    mockDbDelete: vi.fn(() => ({ where: vi.fn() })),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: mockDbQuery,
    delete: () => mockDbDelete(),
  },
  bookmarks: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  relations: vi.fn(),
  sql: vi.fn(),
}));

// --- Imports ---
import { DELETE } from "@/app/api/bookmarks/[resultId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
  mockAuth.mockResolvedValue({ userId: "user_1" });
});

// ==========================================
// DELETE /api/bookmarks/[resultId]
// ==========================================
describe("DELETE /api/bookmarks/[resultId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(
      new Request("http://localhost/api/bookmarks/r_1", { method: "DELETE" }),
      { params: Promise.resolve({ resultId: "r_1" }) }
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });
    const res = await DELETE(
      new Request("http://localhost/api/bookmarks/r_1", { method: "DELETE" }),
      { params: Promise.resolve({ resultId: "r_1" }) }
    );
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("returns 404 when bookmark not found", async () => {
    mockDbQuery.bookmarks.findFirst.mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://localhost/api/bookmarks/r_nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ resultId: "r_nonexistent" }) }
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Bookmark not found");
  });

  it("returns 404 when bookmark belongs to different user", async () => {
    // Route uses and(eq(bookmarks.userId, userId), eq(bookmarks.resultId, resultId))
    // so findFirst returns null for a different user
    mockDbQuery.bookmarks.findFirst.mockResolvedValue(null);
    const res = await DELETE(
      new Request("http://localhost/api/bookmarks/r_1", { method: "DELETE" }),
      { params: Promise.resolve({ resultId: "r_1" }) }
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Bookmark not found");
  });

  it("successfully deletes bookmark and returns success", async () => {
    mockDbQuery.bookmarks.findFirst.mockResolvedValue({
      id: "bk_1",
      userId: "user_1",
      resultId: "r_1",
    });

    const res = await DELETE(
      new Request("http://localhost/api/bookmarks/r_1", { method: "DELETE" }),
      { params: Promise.resolve({ resultId: "r_1" }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it("calls rate limit with correct parameters", async () => {
    mockDbQuery.bookmarks.findFirst.mockResolvedValue({
      id: "bk_1",
      userId: "user_1",
      resultId: "r_1",
    });

    await DELETE(
      new Request("http://localhost/api/bookmarks/r_1", { method: "DELETE" }),
      { params: Promise.resolve({ resultId: "r_1" }) }
    );

    expect(mockCheckApiRateLimit).toHaveBeenCalledWith("user_1", "write");
  });

  it("returns 429 with default retryAfter when not provided", async () => {
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false });
    const res = await DELETE(
      new Request("http://localhost/api/bookmarks/r_1", { method: "DELETE" }),
      { params: Promise.resolve({ resultId: "r_1" }) }
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});
