import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

const mockCheckApiRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "bk_new", userId: "user_1", resultId: "r_1" }]) });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn() });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockDelete = vi.fn().mockReturnValue({ where: vi.fn() });
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      groupBy: vi.fn().mockResolvedValue([]),
    }),
  }),
});

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      bookmarks: { findMany: (...a: unknown[]) => mockFindMany(...a), findFirst: (...a: unknown[]) => mockFindFirst(...a) },
      bookmarkCollections: { findMany: (...a: unknown[]) => mockFindMany(...a), findFirst: (...a: unknown[]) => mockFindFirst(...a) },
      results: { findFirst: (...a: unknown[]) => mockFindFirst(...a) },
    },
    insert: () => mockInsert(),
    update: () => mockUpdate(),
    delete: () => mockDelete(),
    select: () => mockSelect(),
  },
  bookmarks: { userId: "user_id", resultId: "result_id", collectionId: "collection_id", createdAt: "created_at", id: "id" },
  bookmarkCollections: { id: "id", userId: "user_id", createdAt: "created_at" },
  results: { id: "id" },
}));

import { GET as getBookmarks, POST as createBookmark } from "@/app/api/bookmarks/route";
import { GET as getCollections, POST as createCollection, DELETE as deleteCollection } from "@/app/api/bookmarks/collections/route";
import { NextRequest } from "next/server";

// --- Helpers ---

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(`http://localhost${url}`, init);
}

function allowRateLimit() {
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
}

function blockRateLimit() {
  mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks();
  allowRateLimit();
});

// ==========================================
// GET /api/bookmarks
// ==========================================
describe("GET /api/bookmarks", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await getBookmarks(makeRequest("GET", "/api/bookmarks"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    blockRateLimit();
    const res = await getBookmarks(makeRequest("GET", "/api/bookmarks"));
    expect(res.status).toBe(429);
  });

  it("returns bookmarks for authenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindMany.mockResolvedValue([
      { id: "bk_1", resultId: "r_1", result: { title: "Test" }, collection: null },
    ]);
    const res = await getBookmarks(makeRequest("GET", "/api/bookmarks"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bookmarks).toHaveLength(1);
  });
});

// ==========================================
// POST /api/bookmarks
// ==========================================
describe("POST /api/bookmarks", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await createBookmark(makeRequest("POST", "/api/bookmarks", { resultId: "r_1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when resultId is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    const res = await createBookmark(makeRequest("POST", "/api/bookmarks", {}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("resultId is required");
  });

  it("returns 404 when result does not exist", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindFirst.mockResolvedValue(null);
    const res = await createBookmark(makeRequest("POST", "/api/bookmarks", { resultId: "r_nonexist" }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when result belongs to another user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindFirst.mockResolvedValue({ id: "r_1", monitor: { userId: "user_other" } });
    const res = await createBookmark(makeRequest("POST", "/api/bookmarks", { resultId: "r_1" }));
    expect(res.status).toBe(404);
  });

  it("creates bookmark for valid result", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    // First call: results.findFirst (verify result), second: bookmarks.findFirst (duplicate check)
    mockFindFirst
      .mockResolvedValueOnce({ id: "r_1", monitor: { userId: "user_1" } })
      .mockResolvedValueOnce(null); // no duplicate

    const res = await createBookmark(makeRequest("POST", "/api/bookmarks", { resultId: "r_1" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.bookmark).toBeDefined();
  });
});

// ==========================================
// GET /api/bookmarks/collections
// ==========================================
describe("GET /api/bookmarks/collections", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await getCollections();
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    blockRateLimit();
    const res = await getCollections();
    expect(res.status).toBe(429);
  });

  it("returns collections with counts for authenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindMany.mockResolvedValue([
      { id: "col_1", name: "Favorites", userId: "user_1" },
    ]);
    const res = await getCollections();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.collections).toBeDefined();
    expect(json.uncategorizedCount).toBeDefined();
  });
});

// ==========================================
// POST /api/bookmarks/collections
// ==========================================
describe("POST /api/bookmarks/collections", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await createCollection(makeRequest("POST", "/api/bookmarks/collections", { name: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is empty", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    const res = await createCollection(makeRequest("POST", "/api/bookmarks/collections", { name: "  " }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Name is required");
  });

  it("returns 400 when max collections reached", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 20 }]),
      }),
    });
    const res = await createCollection(makeRequest("POST", "/api/bookmarks/collections", { name: "Too Many" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Maximum 20");
  });

  it("creates collection for valid input", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
      }),
    });
    mockInsertValues.mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "col_new", name: "Test", userId: "user_1" }]),
    });
    const res = await createCollection(makeRequest("POST", "/api/bookmarks/collections", { name: "Test" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.collection).toBeDefined();
  });
});

// ==========================================
// DELETE /api/bookmarks/collections
// ==========================================
describe("DELETE /api/bookmarks/collections", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await deleteCollection(makeRequest("DELETE", "/api/bookmarks/collections", { id: "col_1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    const res = await deleteCollection(makeRequest("DELETE", "/api/bookmarks/collections", {}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Collection ID is required");
  });

  it("returns 404 when collection not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindFirst.mockResolvedValue(null);
    const res = await deleteCollection(makeRequest("DELETE", "/api/bookmarks/collections", { id: "col_nonexist" }));
    expect(res.status).toBe(404);
  });

  it("deletes collection and moves bookmarks to uncategorized", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockFindFirst.mockResolvedValue({ id: "col_1", userId: "user_1", name: "Old" });
    const res = await deleteCollection(makeRequest("DELETE", "/api/bookmarks/collections", { id: "col_1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
