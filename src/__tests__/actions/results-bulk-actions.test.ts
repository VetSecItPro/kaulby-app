import { describe, it, expect, vi, beforeEach } from "vitest";

// Task 2.2: tests for the 8 new bulk-action + saved-view server actions on
// the Results page. Each test stubs auth + rate-limit + db so we can assert
// the exact query shape and ownership guard behavior without a real DB.

const {
  mockGetEffectiveUserId,
  mockCheckApiRateLimit,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockRevalidatePath,
} = vi.hoisted(() => {
  return {
    mockGetEffectiveUserId: vi.fn(),
    mockCheckApiRateLimit: vi.fn(),
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockRevalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/dev-auth", () => ({
  getEffectiveUserId: (...args: unknown[]) => mockGetEffectiveUserId(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: (...args: unknown[]) => mockCheckApiRateLimit(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      results: { findFirst: vi.fn() },
      monitors: { findMany: vi.fn() },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  results: { id: "id", monitorId: "monitor_id", isViewed: "is_viewed", isSaved: "is_saved", isHidden: "is_hidden", viewedAt: "viewed_at" },
  monitors: { id: "id", userId: "user_id" },
  savedViews: { id: "id", userId: "user_id", updatedAt: "updated_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  relations: vi.fn(),
  sql: vi.fn(),
}));

import {
  batchMarkResultsRead,
  batchHideResults,
  batchUnhideResults,
  batchSaveResults,
  batchUnsaveResults,
  createSavedView,
  listSavedViews,
  deleteSavedView,
} from "@/app/(dashboard)/dashboard/results/actions";

function chainSelect(returnRows: Array<{ id: string }>) {
  // Supports both shapes:
  //   db.select(...).from(...).innerJoin(...).where(...)            (ownership check, existence count)
  //   db.select(...).from(...).where(...).orderBy(...)              (listSavedViews)
  const orderByFn = vi.fn().mockResolvedValue(returnRows);
  // .where() must be BOTH awaitable (for ownership/count) and chainable to
  // .orderBy() (for list). We return a thenable that also has .orderBy.
  const whereResult: Promise<Array<{ id: string }>> & { orderBy: typeof orderByFn } =
    Object.assign(Promise.resolve(returnRows), { orderBy: orderByFn });
  const whereFn = vi.fn(() => whereResult);
  const innerJoinFn = vi.fn(() => ({ where: whereFn }));
  const fromFn = vi.fn(() => ({ innerJoin: innerJoinFn, where: whereFn }));
  mockSelect.mockReturnValue({ from: fromFn });
  return { whereFn, innerJoinFn, fromFn, orderByFn };
}

function chainUpdate() {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn(() => ({ where: whereFn }));
  mockUpdate.mockReturnValue({ set: setFn });
  return { whereFn, setFn };
}

function chainInsert(returned: unknown) {
  const returningFn = vi.fn().mockResolvedValue([returned]);
  const valuesFn = vi.fn(() => ({ returning: returningFn }));
  mockInsert.mockReturnValue({ values: valuesFn });
  return { returningFn, valuesFn };
}

function chainDelete(returned: Array<{ id: string }>) {
  const returningFn = vi.fn().mockResolvedValue(returned);
  const whereFn = vi.fn(() => ({ returning: returningFn }));
  mockDelete.mockReturnValue({ where: whereFn });
  return { returningFn, whereFn };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEffectiveUserId.mockResolvedValue("user_1");
  mockCheckApiRateLimit.mockResolvedValue({ allowed: true });
});

describe("batchMarkResultsRead", () => {
  it("throws when unauthenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    await expect(batchMarkResultsRead(["a"])).rejects.toThrow("Unauthorized");
  });

  it("throws when rate-limit denies", async () => {
    mockCheckApiRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
    await expect(batchMarkResultsRead(["a"])).rejects.toThrow(/Rate limit/);
  });

  it("returns early with 0 updated when no ids provided", async () => {
    chainSelect([]);
    const res = await batchMarkResultsRead([]);
    expect(res).toEqual({ success: true, updated: 0 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("only updates owned ids", async () => {
    chainSelect([{ id: "r1" }]); // r2 not owned
    chainUpdate();
    const res = await batchMarkResultsRead(["r1", "r2"]);
    expect(res).toEqual({ success: true, updated: 1 });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/results");
  });

  it("rejects oversized batches", async () => {
    const huge = Array.from({ length: 500 }, (_, i) => `id_${i}`);
    await expect(batchMarkResultsRead(huge)).rejects.toThrow(/Batch size/);
  });

  it("rejects non-array input", async () => {
    await expect(batchMarkResultsRead("bad" as unknown as string[])).rejects.toThrow(
      /ids must be an array/
    );
  });
});

describe("batchHideResults / batchUnhideResults", () => {
  it("hides owned ids", async () => {
    chainSelect([{ id: "r1" }]);
    chainUpdate();
    const res = await batchHideResults(["r1"]);
    expect(res).toEqual({ success: true, updated: 1 });
  });

  it("unhides owned ids", async () => {
    chainSelect([{ id: "r1" }]);
    chainUpdate();
    const res = await batchUnhideResults(["r1"]);
    expect(res).toEqual({ success: true, updated: 1 });
  });
});

describe("batchSaveResults / batchUnsaveResults", () => {
  it("saves owned ids", async () => {
    chainSelect([{ id: "r1" }]);
    chainUpdate();
    const res = await batchSaveResults(["r1"]);
    expect(res).toEqual({ success: true, updated: 1 });
  });

  it("unsaves owned ids", async () => {
    chainSelect([{ id: "r1" }]);
    chainUpdate();
    const res = await batchUnsaveResults(["r1"]);
    expect(res).toEqual({ success: true, updated: 1 });
  });
});

describe("createSavedView", () => {
  it("throws when unauthenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    await expect(createSavedView("My view", {})).rejects.toThrow("Unauthorized");
  });

  it("rejects empty names", async () => {
    chainSelect([]);
    await expect(createSavedView("   ", {})).rejects.toThrow(/Name is required/);
  });

  it("rejects overlong names", async () => {
    chainSelect([]);
    await expect(createSavedView("a".repeat(101), {})).rejects.toThrow(/at most/);
  });

  it("caps views per user", async () => {
    chainSelect(Array.from({ length: 50 }, (_, i) => ({ id: `v${i}` })));
    await expect(createSavedView("Another", {})).rejects.toThrow(/more than 50/);
  });

  it("inserts and returns the new view", async () => {
    chainSelect([]);
    const newView = { id: "v1", userId: "user_1", name: "My view", filters: {} };
    chainInsert(newView);
    const res = await createSavedView("My view", { statusFilter: "unread" });
    expect(res.success).toBe(true);
    expect(res.view).toEqual(newView);
  });
});

describe("listSavedViews", () => {
  it("throws when unauthenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    await expect(listSavedViews()).rejects.toThrow("Unauthorized");
  });

  it("returns the user's views", async () => {
    chainSelect([{ id: "v1" }, { id: "v2" }] as Array<{ id: string }>);
    const res = await listSavedViews();
    expect(res.success).toBe(true);
    expect(res.views.length).toBe(2);
  });
});

describe("deleteSavedView", () => {
  it("throws when unauthenticated", async () => {
    mockGetEffectiveUserId.mockResolvedValue(null);
    await expect(deleteSavedView("v1")).rejects.toThrow("Unauthorized");
  });

  it("rejects invalid id", async () => {
    await expect(deleteSavedView("")).rejects.toThrow(/Invalid id/);
  });

  it("throws when nothing was deleted (not owned)", async () => {
    chainDelete([]);
    await expect(deleteSavedView("v_other")).rejects.toThrow(/Not found/);
  });

  it("deletes an owned view", async () => {
    chainDelete([{ id: "v1" }]);
    const res = await deleteSavedView("v1");
    expect(res).toEqual({ success: true });
  });
});
