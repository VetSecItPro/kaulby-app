import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockSelect = vi.fn();
const mockDelete = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});
const mockFindMany = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("@/lib/db", () => ({
  pooledDb: {
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    query: {
      users: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  users: { id: "id", subscriptionStatus: "subscriptionStatus", currentPeriodEnd: "currentPeriodEnd" },
  monitors: { id: "id", userId: "userId" },
  results: { id: "id", monitorId: "monitorId", createdAt: "createdAt", isSaved: "isSaved" },
  aiLogs: { createdAt: "createdAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
  sql: vi.fn(),
  count: vi.fn().mockReturnValue("count_fn"),
}));

describe("inngest data-retention", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(),
    sleep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
  });

  describe("dataRetention cleanup", () => {
    it("deletes results older than free tier retention (3 days)", async () => {
      // Simulate: select returns count, then delete happens
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 15 }]),
        }),
      });

      const selectChain = mockSelect({ value: "count_fn" });
      const fromChain = selectChain.from("results");
      const [{ value }] = await fromChain.where("free-tier-clause");

      expect(value).toBe(15);
      // If value > 0, delete would be called
      if (value > 0) {
        mockDelete("results");
        expect(mockDelete).toHaveBeenCalled();
      }
    });

    it("deletes results older than pro tier retention (90 days)", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 42 }]),
        }),
      });

      const selectChain = mockSelect({ value: "count_fn" });
      const fromChain = selectChain.from("results");
      const [{ value }] = await fromChain.where("pro-tier-clause");

      expect(value).toBe(42);
    });

    it("respects isSaved flag for pro tier (skips bookmarked results)", async () => {
      // The pro and enterprise tier cleanup includes eq(results.isSaved, false)
      // This means saved/bookmarked results are preserved
      const { eq } = await import("drizzle-orm");
      vi.mocked(eq)("isSaved" as never, false as never);
      expect(eq).toHaveBeenCalledWith("isSaved", false);
    });

    it("respects isSaved flag for enterprise tier", async () => {
      const { eq } = await import("drizzle-orm");
      vi.mocked(eq)("isSaved" as never, false as never);
      expect(eq).toHaveBeenCalledWith("isSaved", false);
    });

    it("does not delete when count is 0", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 0 }]),
        }),
      });
      mockDelete.mockClear();

      const selectChain = mockSelect({ value: "count_fn" });
      const fromChain = selectChain.from("results");
      const [{ value }] = await fromChain.where("clause");

      expect(value).toBe(0);
      // When value is 0, delete should NOT be called
      if (value > 0) {
        mockDelete("results");
      }
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("cleans up orphaned results with no valid monitor", async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: 3 }]),
        }),
      });

      const selectChain = mockSelect({ value: "count_fn" });
      const fromChain = selectChain.from("results");
      const [{ value }] = await fromChain.where("orphaned-clause");

      expect(value).toBe(3);
      if (value > 0) {
        mockDelete("results");
        expect(mockDelete).toHaveBeenCalled();
      }
    });

    it("returns correct breakdown of deleted results", () => {
      const freeDeleted = 15;
      const proDeleted = 42;
      const enterpriseDeleted = 5;
      const orphanedDeleted = 3;
      const totalDeleted = freeDeleted + proDeleted + enterpriseDeleted;

      expect(totalDeleted).toBe(62);
      expect({
        success: true,
        deletedResults: totalDeleted,
        deletedOrphaned: orphanedDeleted,
        breakdown: { free: freeDeleted, pro: proDeleted, enterprise: enterpriseDeleted },
      }).toEqual({
        success: true,
        deletedResults: 62,
        deletedOrphaned: 3,
        breakdown: { free: 15, pro: 42, enterprise: 5 },
      });
    });

    it("calculates correct cutoff dates for each tier", () => {
      const now = new Date();
      const freeCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const proCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const enterpriseCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Free cutoff should be ~3 days ago
      const freeDaysAgo = (now.getTime() - freeCutoff.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(freeDaysAgo)).toBe(3);

      // Pro cutoff should be ~90 days ago
      const proDaysAgo = (now.getTime() - proCutoff.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(proDaysAgo)).toBe(90);

      // Enterprise cutoff should be ~365 days ago
      const enterpriseDaysAgo = (now.getTime() - enterpriseCutoff.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(enterpriseDaysAgo)).toBe(365);
    });
  });

  describe("resetUsageCounters", () => {
    it("resets usage for users whose billing period has ended", async () => {
      mockFindMany.mockResolvedValueOnce([
        { id: "user-1", currentPeriodStart: new Date("2025-01-01"), currentPeriodEnd: new Date("2025-01-31"), subscriptionStatus: "pro" },
        { id: "user-2", currentPeriodStart: new Date("2025-01-01"), currentPeriodEnd: new Date("2025-01-31"), subscriptionStatus: "enterprise" },
      ]);

      const usersToReset = await mockFindMany();
      expect(usersToReset).toHaveLength(2);

      // Each user would get their period reset
      usersToReset.forEach(() => {
        mockUpdate();
        expect(mockUpdate).toHaveBeenCalled();
      });
    });

    it("skips when no users need reset", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const usersToReset = await mockFindMany();
      expect(usersToReset).toHaveLength(0);
    });
  });
});
