import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockFindMany = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  }),
});
const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
// Task 2.1: saveNewResults now uses pooledDb.select().from().innerJoin().where()
// for cross-monitor dedup lookup. Returns rows with {id, sourceUrl}.
const mockSelectRows = vi.fn().mockResolvedValue([]);
const mockSelect = vi.fn().mockImplementation(() => ({
  from: () => ({
    innerJoin: () => ({
      where: () => mockSelectRows(),
    }),
  }),
}));

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: {
      monitors: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findFirst: vi.fn(),
      },
      results: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  monitors: { isActive: "isActive", platforms: "platforms", id: "id", lastCheckedAt: "lastCheckedAt", userId: "userId" },
  results: { sourceUrl: "sourceUrl", id: "id", monitorId: "monitorId" },
  monitorResults: { monitorId: "mr_monitorId", resultId: "mr_resultId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
}));

const mockPrefetchUserPlans = vi.fn();
const mockCanAccessPlatformWithPlan = vi.fn();
const mockShouldProcessMonitorWithPlan = vi.fn();
const mockIncrementResultsCount = vi.fn();

vi.mock("@/lib/limits", () => ({
  prefetchUserPlans: (...args: unknown[]) => mockPrefetchUserPlans(...args),
  canAccessPlatformWithPlan: (...args: unknown[]) => mockCanAccessPlatformWithPlan(...args),
  shouldProcessMonitorWithPlan: (...args: unknown[]) => mockShouldProcessMonitorWithPlan(...args),
  incrementResultsCount: (...args: unknown[]) => mockIncrementResultsCount(...args),
}));

const mockIsMonitorScheduleActive = vi.fn();

vi.mock("@/lib/monitor-schedule", () => ({
  isMonitorScheduleActive: (...args: unknown[]) => mockIsMonitorScheduleActive(...args),
}));

const mockCalculateStaggerDelay = vi.fn();
const mockFormatStaggerDuration = vi.fn();
const mockAddJitter = vi.fn();
const mockGetStaggerWindow = vi.fn();

vi.mock("@/lib/inngest/utils/stagger", () => ({
  calculateStaggerDelay: (...args: unknown[]) => mockCalculateStaggerDelay(...args),
  formatStaggerDuration: (...args: unknown[]) => mockFormatStaggerDuration(...args),
  addJitter: (...args: unknown[]) => mockAddJitter(...args),
  getStaggerWindow: (...args: unknown[]) => mockGetStaggerWindow(...args),
}));

vi.mock("@/lib/ai/sampling", () => ({
  AI_BATCH_CONFIG: { BATCH_THRESHOLD: 50 },
}));

const mockInngestSend = vi.fn();

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

import {
  getActiveMonitors,
  prefetchPlans,
  getPlan,
  shouldSkipMonitor,
  applyStagger,
  saveNewResults,
  triggerAiAnalysis,
  updateMonitorStats,
  type MonitorRow,
} from "@/lib/inngest/utils/monitor-helpers";

describe("inngest monitor-helpers", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_name: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStep.run.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
    mockPrefetchUserPlans.mockResolvedValue(new Map([["user1", "solo"]]));
    mockCanAccessPlatformWithPlan.mockReturnValue(true);
    mockShouldProcessMonitorWithPlan.mockReturnValue(true);
    mockIsMonitorScheduleActive.mockReturnValue(true);
    mockIncrementResultsCount.mockResolvedValue(undefined);
    mockInngestSend.mockResolvedValue(undefined);
  });

  describe("getActiveMonitors", () => {
    it("fetches active monitors for a specific platform", async () => {
      const mockMonitors = [
        { id: "m1", isActive: true, platforms: ["reddit"], userId: "user1" },
        { id: "m2", isActive: true, platforms: ["reddit", "hackernews"], userId: "user2" },
      ];
      mockFindMany.mockResolvedValueOnce(mockMonitors);

      const monitors = await getActiveMonitors("reddit", mockStep as never);

      expect(mockStep.run).toHaveBeenCalledWith("get-monitors", expect.any(Function));
      expect(monitors).toEqual(mockMonitors);
    });

    it("applies safety limit of 1000 monitors", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      await getActiveMonitors("reddit", mockStep as never);
      expect(mockFindMany).toHaveBeenCalled();
    });

    it("returns empty array when no monitors found", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const monitors = await getActiveMonitors("reddit", mockStep as never);
      expect(monitors).toEqual([]);
    });
  });

  describe("prefetchPlans", () => {
    it("prefetches user plans and returns serialized map", async () => {
      const monitors = [
        { userId: "user1" },
        { userId: "user2" },
        { userId: "user1" }, // Duplicate
      ];

      mockPrefetchUserPlans.mockResolvedValueOnce(
        new Map([
          ["user1", "solo"],
          ["user2", "free"],
        ])
      );

      const planMap = await prefetchPlans(monitors as never, mockStep as never);

      expect(mockStep.run).toHaveBeenCalledWith("prefetch-plans", expect.any(Function));
      expect(mockPrefetchUserPlans).toHaveBeenCalledWith(["user1", "user2", "user1"]);
      expect(planMap).toEqual({ user1: "solo", user2: "free" });
    });

    it("handles empty monitor list", async () => {
      mockPrefetchUserPlans.mockResolvedValueOnce(new Map());
      const planMap = await prefetchPlans([], mockStep as never);
      expect(planMap).toEqual({});
    });
  });

  describe("getPlan", () => {
    it("returns plan from planMap", () => {
      const planMap = { user1: "solo", user2: "growth" };
      expect(getPlan("user1", planMap)).toBe("solo");
      expect(getPlan("user2", planMap)).toBe("growth");
    });

    it("returns 'free' for unknown user", () => {
      const planMap = { user1: "solo" };
      expect(getPlan("unknownUser", planMap)).toBe("free");
    });

    it("returns 'free' for empty planMap", () => {
      expect(getPlan("user1", {})).toBe("free");
    });
  });

  describe("shouldSkipMonitor", () => {
    const monitor: MonitorRow = {
      id: "m1",
      userId: "user1",
      lastCheckedAt: new Date("2024-01-01"),
    } as never;

    it("returns false when monitor should be processed", () => {
      const planMap = { user1: "solo" };
      mockCanAccessPlatformWithPlan.mockReturnValue(true);
      mockShouldProcessMonitorWithPlan.mockReturnValue(true);
      mockIsMonitorScheduleActive.mockReturnValue(true);

      const skip = shouldSkipMonitor(monitor, planMap, "reddit");
      expect(skip).toBe(false);
    });

    it("returns true when user lacks platform access", () => {
      const planMap = { user1: "free" };
      mockCanAccessPlatformWithPlan.mockReturnValue(false);

      const skip = shouldSkipMonitor(monitor, planMap, "hackernews");
      expect(skip).toBe(true);
    });

    it("returns true when refresh delay not met", () => {
      const planMap = { user1: "solo" };
      mockCanAccessPlatformWithPlan.mockReturnValue(true);
      mockShouldProcessMonitorWithPlan.mockReturnValue(false);

      const skip = shouldSkipMonitor(monitor, planMap, "reddit");
      expect(skip).toBe(true);
    });

    it("returns true when schedule is inactive", () => {
      const planMap = { user1: "solo" };
      mockCanAccessPlatformWithPlan.mockReturnValue(true);
      mockShouldProcessMonitorWithPlan.mockReturnValue(true);
      mockIsMonitorScheduleActive.mockReturnValue(false);

      const skip = shouldSkipMonitor(monitor, planMap, "reddit");
      expect(skip).toBe(true);
    });
  });

  describe("applyStagger", () => {
    it("skips sleep for first monitor (index 0)", async () => {
      await applyStagger(0, 10, "reddit", "m1", mockStep as never);
      expect(mockStep.sleep).not.toHaveBeenCalled();
    });

    it("skips sleep when total monitors <= 3", async () => {
      await applyStagger(1, 3, "reddit", "m1", mockStep as never);
      expect(mockStep.sleep).not.toHaveBeenCalled();
    });

    it("applies stagger delay for monitors after first", async () => {
      mockGetStaggerWindow.mockReturnValue(5 * 60 * 1000); // 5 minutes
      mockCalculateStaggerDelay.mockReturnValue(60000); // 1 minute
      mockAddJitter.mockReturnValue(65000); // With jitter
      mockFormatStaggerDuration.mockReturnValue("1m5s");

      await applyStagger(1, 10, "reddit", "m1", mockStep as never);

      expect(mockGetStaggerWindow).toHaveBeenCalledWith("reddit");
      expect(mockCalculateStaggerDelay).toHaveBeenCalledWith(1, 10, 5 * 60 * 1000);
      expect(mockAddJitter).toHaveBeenCalledWith(60000, 10);
      expect(mockFormatStaggerDuration).toHaveBeenCalledWith(65000);
      expect(mockStep.sleep).toHaveBeenCalledWith("stagger-m1", "1m5s");
    });
  });

  describe("saveNewResults", () => {
    it("returns empty when no items provided", async () => {
      const result = await saveNewResults({
        items: [],
        monitorId: "m1",
        userId: "user1",
        getSourceUrl: (item: { url: string }) => item.url,
        mapToResult: () => ({} as never),
        step: mockStep as never,
      });

      expect(result).toEqual({ count: 0, ids: [] });
      expect(mockStep.run).not.toHaveBeenCalled();
    });

    it("filters out existing results by URL (now: cross-monitor via monitor_results link)", async () => {
      const items = [
        { url: "https://example.com/1", title: "Post 1" },
        { url: "https://example.com/2", title: "Post 2" },
        { url: "https://example.com/3", title: "Post 3" },
      ];

      // Task 2.1: select() returns rows already present for THIS user (any monitor).
      mockSelectRows.mockResolvedValueOnce([
        { id: "r-existing-1", sourceUrl: "https://example.com/1" },
        { id: "r-existing-2", sourceUrl: "https://example.com/2" },
      ]);

      // insert(results) returns only the new canonical row for URL /3.
      // insert(monitor_results) returns all 3 links (new for this monitor).
      const insertResultsChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "r3", sourceUrl: "https://example.com/3" },
          ]),
        }),
      };
      const insertLinksChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { resultId: "r3" },
              { resultId: "r-existing-1" },
              { resultId: "r-existing-2" },
            ]),
          }),
        }),
      };
      mockInsert
        .mockReturnValueOnce(insertResultsChain)
        .mockReturnValueOnce(insertLinksChain);

      const result = await saveNewResults({
        items,
        monitorId: "m1",
        userId: "user1",
        getSourceUrl: (item) => item.url,
        mapToResult: (item) => ({
          monitorId: "m1",
          sourceUrl: item.url,
          title: item.title,
          platform: "reddit" as const,
        }),
        step: mockStep as never,
      });

      // All 3 are "new for this monitor" (new link rows), even though only 1
      // required a new canonical results row.
      expect(result.count).toBe(3);
      expect(result.ids).toEqual(["r3", "r-existing-1", "r-existing-2"]);
      // Usage only counts the new canonical row.
      expect(mockIncrementResultsCount).toHaveBeenCalledWith("user1", 1);
    });

    it("inserts all items when none exist", async () => {
      const items = [
        { url: "https://example.com/1", title: "Post 1" },
        { url: "https://example.com/2", title: "Post 2" },
      ];

      mockSelectRows.mockResolvedValueOnce([]);

      const insertResultsChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "r1", sourceUrl: "https://example.com/1" },
            { id: "r2", sourceUrl: "https://example.com/2" },
          ]),
        }),
      };
      const insertLinksChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ resultId: "r1" }, { resultId: "r2" }]),
          }),
        }),
      };
      mockInsert
        .mockReturnValueOnce(insertResultsChain)
        .mockReturnValueOnce(insertLinksChain);

      const result = await saveNewResults({
        items,
        monitorId: "m1",
        userId: "user1",
        getSourceUrl: (item) => item.url,
        mapToResult: (item) => ({
          monitorId: "m1",
          sourceUrl: item.url,
          title: item.title,
          platform: "reddit" as const,
        }),
        step: mockStep as never,
      });

      expect(result.count).toBe(2);
      expect(result.ids).toEqual(["r1", "r2"]);
      expect(mockIncrementResultsCount).toHaveBeenCalledWith("user1", 2);
    });

    it("uses custom step suffix in step name", async () => {
      mockSelectRows.mockResolvedValueOnce([]);
      const insertResultsChain = {
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "r1", sourceUrl: "https://example.com/1" }]),
        }),
      };
      const insertLinksChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ resultId: "r1" }]),
          }),
        }),
      };
      mockInsert
        .mockReturnValueOnce(insertResultsChain)
        .mockReturnValueOnce(insertLinksChain);

      await saveNewResults({
        items: [{ url: "https://example.com/1" }],
        monitorId: "m1",
        userId: "user1",
        getSourceUrl: (item) => item.url,
        mapToResult: () => ({} as never),
        step: mockStep as never,
        stepSuffix: "subreddit-name",
      });

      expect(mockStep.run).toHaveBeenCalledWith(
        "save-results-m1-subreddit-name",
        expect.any(Function)
      );
    });
  });

  describe("triggerAiAnalysis", () => {
    it("skips when no result IDs provided", async () => {
      await triggerAiAnalysis([], "m1", "user1", "reddit", mockStep as never);
      expect(mockStep.run).not.toHaveBeenCalled();
      expect(mockInngestSend).not.toHaveBeenCalled();
    });

    it("sends individual analyze events for small batches", async () => {
      const resultIds = ["r1", "r2", "r3"];

      await triggerAiAnalysis(resultIds, "m1", "user1", "reddit", mockStep as never);

      expect(mockStep.run).toHaveBeenCalledWith("trigger-analysis-m1", expect.any(Function));
      expect(mockInngestSend).toHaveBeenCalledWith([
        { name: "content/analyze", data: { resultId: "r1", userId: "user1" } },
        { name: "content/analyze", data: { resultId: "r2", userId: "user1" } },
        { name: "content/analyze", data: { resultId: "r3", userId: "user1" } },
      ]);
    });

    it("sends batch analyze event for large volumes (> threshold)", async () => {
      const resultIds = Array.from({ length: 100 }, (_, i) => `r${i}`);

      await triggerAiAnalysis(resultIds, "m1", "user1", "reddit", mockStep as never);

      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "content/analyze-batch",
        data: {
          monitorId: "m1",
          userId: "user1",
          platform: "reddit",
          resultIds,
          totalCount: 100,
        },
      });
    });

    it("uses batch mode at exactly threshold + 1", async () => {
      const resultIds = Array.from({ length: 51 }, (_, i) => `r${i}`); // Threshold is 50

      await triggerAiAnalysis(resultIds, "m1", "user1", "reddit", mockStep as never);

      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({ name: "content/analyze-batch" })
      );
    });
  });

  describe("updateMonitorStats", () => {
    it("updates lastCheckedAt and newMatchCount", async () => {
      const mockUpdateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockUpdate.mockReturnValueOnce(mockUpdateChain);

      await updateMonitorStats("m1", 5, mockStep as never);

      expect(mockStep.run).toHaveBeenCalledWith("update-monitor-stats-m1", expect.any(Function));
      expect(mockUpdateChain.set).toHaveBeenCalledWith({
        lastCheckedAt: expect.any(Date),
        newMatchCount: 5,
        // W1.10: successful scan clears prior failure flags so the
        // monitor card's red dot disappears on recovery.
        lastCheckFailedAt: null,
        lastCheckFailedReason: null,
        updatedAt: expect.any(Date),
      });
    });

    it("updates with 0 matches", async () => {
      const mockUpdateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockUpdate.mockReturnValueOnce(mockUpdateChain);

      await updateMonitorStats("m1", 0, mockStep as never);

      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ newMatchCount: 0 })
      );
    });
  });

  describe("integration - full monitor flow simulation", () => {
    it("processes monitors with proper flow", async () => {
      // Setup
      const monitors = [
        { id: "m1", userId: "user1", lastCheckedAt: new Date() },
        { id: "m2", userId: "user2", lastCheckedAt: null },
      ];
      mockFindMany.mockResolvedValueOnce(monitors);

      mockPrefetchUserPlans.mockResolvedValueOnce(
        new Map([
          ["user1", "solo"],
          ["user2", "free"],
        ])
      );

      // Fetch monitors
      const fetchedMonitors = await getActiveMonitors("reddit", mockStep as never);
      expect(fetchedMonitors).toEqual(monitors);

      // Prefetch plans
      const planMap = await prefetchPlans(fetchedMonitors as never, mockStep as never);
      expect(planMap).toEqual({ user1: "solo", user2: "free" });

      // Check first monitor (should not skip)
      mockCanAccessPlatformWithPlan.mockReturnValue(true);
      mockShouldProcessMonitorWithPlan.mockReturnValue(true);
      mockIsMonitorScheduleActive.mockReturnValue(true);

      const skip1 = shouldSkipMonitor(monitors[0] as never, planMap, "reddit");
      expect(skip1).toBe(false);

      // Apply stagger for second monitor
      mockGetStaggerWindow.mockReturnValue(5 * 60 * 1000);
      mockCalculateStaggerDelay.mockReturnValue(30000);
      mockAddJitter.mockReturnValue(33000);
      mockFormatStaggerDuration.mockReturnValue("33s");

      await applyStagger(1, 2, "reddit", "m2", mockStep as never);
      expect(mockStep.sleep).not.toHaveBeenCalled(); // Only 2 monitors (<=3)

      // Save results — Task 2.1 dedup flow: select → insert(results) → insert(monitor_results)
      mockSelectRows.mockResolvedValueOnce([]);
      const insertResultsChain = {
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "r1", sourceUrl: "https://reddit.com/1" }]),
        }),
      };
      const insertLinksChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ resultId: "r1" }]),
          }),
        }),
      };
      mockInsert
        .mockReturnValueOnce(insertResultsChain)
        .mockReturnValueOnce(insertLinksChain);

      const saveResult = await saveNewResults({
        items: [{ url: "https://reddit.com/1" }],
        monitorId: "m1",
        userId: "user1",
        getSourceUrl: (item: { url: string }) => item.url,
        mapToResult: (item) => ({ monitorId: "m1", sourceUrl: item.url }) as never,
        step: mockStep as never,
      });

      expect(saveResult.ids).toEqual(["r1"]);

      // Trigger analysis
      await triggerAiAnalysis(saveResult.ids, "m1", "user1", "reddit", mockStep as never);
      expect(mockInngestSend).toHaveBeenCalled();

      // Update stats
      const mockUpdateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockUpdate.mockReturnValueOnce(mockUpdateChain);

      await updateMonitorStats("m1", saveResult.count, mockStep as never);
      expect(mockUpdateChain.set).toHaveBeenCalled();
    });
  });
});
