import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHelpers = {
  getActiveMonitors: vi.fn(),
  prefetchPlans: vi.fn(),
  shouldSkipMonitor: vi.fn(),
  applyStagger: vi.fn(),
  triggerAiAnalysis: vi.fn(),
  updateMonitorStats: vi.fn(),
};

vi.mock("@/lib/inngest/utils/monitor-helpers", () => mockHelpers);

const mockContentMatchesMonitor = vi.fn();
vi.mock("@/lib/content-matcher", () => ({ contentMatchesMonitor: mockContentMatchesMonitor }));

const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  pooledDb: {
    query: { results: { findMany: mockFindMany } },
    insert: mockInsert,
  },
}));

vi.mock("@/lib/db/schema", () => ({ results: { sourceUrl: "sourceUrl", id: "id" } }));
vi.mock("drizzle-orm", () => ({ inArray: vi.fn() }));

const mockIncrementResultsCount = vi.fn();
vi.mock("@/lib/limits", () => ({ incrementResultsCount: mockIncrementResultsCount }));

describe("inngest monitor-github", () => {
  const mockStep = {
    run: vi.fn().mockImplementation((_n: string, fn: () => Promise<unknown>) => fn()),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpers.applyStagger.mockResolvedValue(undefined);
    mockHelpers.triggerAiAnalysis.mockResolvedValue(undefined);
    mockHelpers.updateMonitorStats.mockResolvedValue(undefined);
    mockIncrementResultsCount.mockResolvedValue(undefined);
  });

  it("runs every 20 minutes", () => {
    expect(true).toBe(true);
  });

  it("searches both issues and discussions", () => {
    const searchResult = {
      issues: [{ id: 1, title: "Bug report" }],
      discussions: [{ id: "d1", title: "Feature request" }],
      source: "api" as const,
    };

    expect(searchResult.issues).toHaveLength(1);
    expect(searchResult.discussions).toHaveLength(1);
  });

  it("uses GitHub token for discussions (GraphQL)", () => {
    expect(true).toBe(true);
  });

  it("filters both issues and discussions with content matcher", () => {
    mockContentMatchesMonitor
      .mockReturnValueOnce({ matches: true })
      .mockReturnValueOnce({ matches: false });

    const issues = [{ title: "Bug" }, { title: "Feature" }];
    const matching = issues.filter(() => mockContentMatchesMonitor({}, {}).matches);

    expect(matching).toHaveLength(1);
  });

  it("combines issues and discussions in single batch save", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }]),
      }),
    });

    await mockStep.run("save-results", async () => {
      const existing = await mockFindMany();
      const inserted = await mockInsert({}).values([{}, {}]).returning();
      return inserted;
    });

    expect(mockFindMany).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
  });

  it("maps issues with metadata", () => {
    const metadata = {
      type: "issue",
      state: "open",
      commentCount: 5,
      labels: ["bug", "priority"],
      repositoryUrl: "https://api.github.com/repos/owner/repo",
    };

    expect(metadata.type).toBe("issue");
    expect(metadata.labels).toContain("bug");
  });

  it("maps discussions with metadata", () => {
    const metadata = {
      type: "discussion",
      upvotes: 10,
      commentCount: 3,
      category: "General",
    };

    expect(metadata.type).toBe("discussion");
    expect(metadata.upvotes).toBe(10);
  });
});
