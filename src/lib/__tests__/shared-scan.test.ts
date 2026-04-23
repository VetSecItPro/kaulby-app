import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Force in-memory cache fallback
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

// PostHog capture is a no-op in tests — we only care about the return shape
vi.mock("@/lib/posthog", () => ({
  captureEvent: vi.fn(),
}));

async function loadModule() {
  // Force a clean in-memory cache per test file run by re-importing
  vi.resetModules();
  return import("../shared-scan");
}

describe("shared-scan", () => {
  beforeEach(() => {
    // Fix time so all tests within a describe block fall in the same window
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("first call misses, second call in same window hits", async () => {
    const { dedupedScan } = await loadModule();
    const fetchFn = vi.fn().mockResolvedValue([{ id: "post-1" }]);

    const a = await dedupedScan("reddit", "SaaS", 30, fetchFn);
    expect(a.cached).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const b = await dedupedScan("reddit", "SaaS", 30, fetchFn);
    expect(b.cached).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1); // NOT called again
    expect(b.data).toEqual([{ id: "post-1" }]);
  });

  it("keyword-agnostic: different callers for same resource share the cache", async () => {
    const { dedupedScan } = await loadModule();
    // User A's monitor and User B's monitor are calling for the same
    // subreddit, with totally different downstream keywords. The scraper
    // is keyword-agnostic so they should share.
    const scrapeAll = vi.fn().mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    await dedupedScan("reddit", "SaaS", 30, scrapeAll);
    await dedupedScan("reddit", "SaaS", 30, scrapeAll);
    await dedupedScan("reddit", "SaaS", 30, scrapeAll);

    expect(scrapeAll).toHaveBeenCalledTimes(1);
  });

  it("resource name is case-insensitive", async () => {
    const { dedupedScan } = await loadModule();
    const fetchFn = vi.fn().mockResolvedValue([]);

    await dedupedScan("reddit", "SaaS", 30, fetchFn);
    await dedupedScan("reddit", "saas", 30, fetchFn);
    await dedupedScan("reddit", "SAAS", 30, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("different resources don't share", async () => {
    const { dedupedScan } = await loadModule();
    const fetchA = vi.fn().mockResolvedValue(["A"]);
    const fetchB = vi.fn().mockResolvedValue(["B"]);

    await dedupedScan("reddit", "SaaS", 30, fetchA);
    await dedupedScan("reddit", "startups", 30, fetchB);

    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(fetchB).toHaveBeenCalledTimes(1);
  });

  it("different platforms don't share even with same resource name", async () => {
    const { dedupedScan } = await loadModule();
    const fetchReddit = vi.fn().mockResolvedValue(["reddit-posts"]);
    const fetchHN = vi.fn().mockResolvedValue(["hn-posts"]);

    await dedupedScan("reddit", "startups", 30, fetchReddit);
    await dedupedScan("hackernews", "startups", 30, fetchHN);

    expect(fetchReddit).toHaveBeenCalledTimes(1);
    expect(fetchHN).toHaveBeenCalledTimes(1);
  });

  it("next window fires a fresh scrape", async () => {
    const { dedupedScan } = await loadModule();
    const fetchFn = vi.fn().mockResolvedValue([]);

    await dedupedScan("reddit", "SaaS", 30, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Advance past the current window boundary
    vi.setSystemTime(new Date("2026-04-23T12:35:00Z"));

    await dedupedScan("reddit", "SaaS", 30, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("returns the same windowStartMs for callers within one window", async () => {
    const { dedupedScan } = await loadModule();
    const fetchFn = vi.fn().mockResolvedValue([]);

    const a = await dedupedScan("reddit", "SaaS", 30, fetchFn);
    const b = await dedupedScan("reddit", "SaaS", 30, fetchFn);

    expect(a.windowStartMs).toBe(b.windowStartMs);
  });
});
