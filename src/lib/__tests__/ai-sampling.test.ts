import { describe, it, expect } from "vitest";
import {
  selectRepresentativeSample,
  getAdaptiveSampleSize,
  getAdaptiveSamplingConfig,
  AI_BATCH_CONFIG,
  type SampleableItem,
} from "@/lib/ai/sampling";

describe("ai/sampling", () => {
  const createMockItem = (id: string, overrides?: Partial<SampleableItem>): SampleableItem => ({
    id,
    content: `Content for ${id}`,
    title: `Title ${id}`,
    engagement: 10,
    rating: 3,
    createdAt: new Date(),
    ...overrides,
  });

  describe("AI_BATCH_CONFIG", () => {
    it("has expected configuration values", () => {
      expect(AI_BATCH_CONFIG.BATCH_THRESHOLD).toBe(50);
      expect(AI_BATCH_CONFIG.MIN_SAMPLE_SIZE).toBe(25);
      expect(AI_BATCH_CONFIG.MAX_SAMPLE_SIZE).toBe(150);
      expect(AI_BATCH_CONFIG.TARGET_COVERAGE_PERCENT).toBe(15);
      expect(AI_BATCH_CONFIG.BATCH_MODEL).toBe("google/gemini-2.5-flash");
    });
  });

  describe("selectRepresentativeSample", () => {
    it("returns all items if count <= sample size", () => {
      const items = [
        createMockItem("1"),
        createMockItem("2"),
        createMockItem("3"),
      ];

      const result = selectRepresentativeSample(items, { sampleSize: 25 });

      expect(result).toHaveLength(3);
      expect(result).toEqual(items);
    });

    it("returns exactly sampleSize items when input is larger", () => {
      const items = Array.from({ length: 100 }, (_, i) => createMockItem(`item-${i}`));

      const result = selectRepresentativeSample(items, { sampleSize: 25 });

      expect(result).toHaveLength(25);
    });

    it("includes high engagement items", () => {
      const items = [
        createMockItem("low-eng", { engagement: 5 }),
        createMockItem("high-eng-1", { engagement: 500 }),
        createMockItem("high-eng-2", { engagement: 300 }),
        ...Array.from({ length: 50 }, (_, i) => createMockItem(`filler-${i}`, { engagement: 10 })),
      ];

      const result = selectRepresentativeSample(items, { sampleSize: 25, topEngagedCount: 2 });

      const selectedIds = result.map((r) => r.id);
      expect(selectedIds).toContain("high-eng-1");
      expect(selectedIds).toContain("high-eng-2");
    });

    it("includes recent items", () => {
      const now = new Date();
      const items = [
        createMockItem("old", { createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }),
        createMockItem("recent-1", { createdAt: new Date(now.getTime() - 1000) }),
        createMockItem("recent-2", { createdAt: new Date(now.getTime() - 2000) }),
        ...Array.from({ length: 50 }, (_, i) =>
          createMockItem(`filler-${i}`, { createdAt: new Date(now.getTime() - 10000 * i) })
        ),
      ];

      const result = selectRepresentativeSample(items, { sampleSize: 25, recentCount: 2 });

      const selectedIds = result.map((r) => r.id);
      expect(selectedIds).toContain("recent-1");
      expect(selectedIds).toContain("recent-2");
    });

    it("includes extreme ratings (lowest first)", () => {
      const items = [
        createMockItem("high-rating", { rating: 5 }),
        createMockItem("low-1", { rating: 1 }),
        createMockItem("low-2", { rating: 2 }),
        ...Array.from({ length: 50 }, (_, i) => createMockItem(`filler-${i}`, { rating: 3 })),
      ];

      const result = selectRepresentativeSample(items, { sampleSize: 25, extremeRatingCount: 2 });

      const selectedIds = result.map((r) => r.id);
      expect(selectedIds).toContain("low-1");
    });

    it("includes detailed content (longest)", () => {
      const items = [
        createMockItem("short", { content: "abc" }),
        createMockItem("long-1", { content: "a".repeat(1000) }),
        createMockItem("long-2", { content: "b".repeat(900) }),
        ...Array.from({ length: 50 }, (_, i) => createMockItem(`filler-${i}`, { content: "filler" })),
      ];

      const result = selectRepresentativeSample(items, { sampleSize: 25, detailedCount: 2 });

      const selectedIds = result.map((r) => r.id);
      expect(selectedIds).toContain("long-1");
      expect(selectedIds).toContain("long-2");
    });

    it("does not include duplicates", () => {
      const items = Array.from({ length: 50 }, (_, i) =>
        createMockItem(`item-${i}`, {
          engagement: i % 5 === 0 ? 100 : 10,
          rating: i % 3 === 0 ? 1 : 3,
          content: i % 7 === 0 ? "very long content here".repeat(10) : "short",
        })
      );

      const result = selectRepresentativeSample(items, { sampleSize: 25 });

      const ids = result.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(ids).toHaveLength(uniqueIds.size);
    });

    it("uses default config when not provided", () => {
      const items = Array.from({ length: 100 }, (_, i) => createMockItem(`item-${i}`));

      const result = selectRepresentativeSample(items);

      expect(result).toHaveLength(25);
    });

    it("handles items without optional fields", () => {
      const items = [
        { id: "1", content: "No extras" },
        { id: "2", content: "Also minimal", title: "Has title" },
        ...Array.from({ length: 30 }, (_, i) => ({ id: `${i + 3}`, content: `Item ${i}` })),
      ];

      const result = selectRepresentativeSample(items, { sampleSize: 10 });

      expect(result).toHaveLength(10);
    });
  });

  describe("getAdaptiveSampleSize", () => {
    it("returns MIN_SAMPLE_SIZE for small batches", () => {
      expect(getAdaptiveSampleSize(50)).toBe(25);
      expect(getAdaptiveSampleSize(100)).toBe(25);
    });

    it("scales with totalCount up to MAX_SAMPLE_SIZE", () => {
      expect(getAdaptiveSampleSize(200)).toBeGreaterThan(25);
      expect(getAdaptiveSampleSize(500)).toBeGreaterThan(25);
      expect(getAdaptiveSampleSize(1000)).toBeGreaterThan(25);
    });

    it("caps at MAX_SAMPLE_SIZE", () => {
      expect(getAdaptiveSampleSize(5000)).toBe(150);
      expect(getAdaptiveSampleSize(10000)).toBe(150);
    });

    it("calculates ~15% of total count within bounds", () => {
      const totalCount = 300;
      const expectedSize = Math.ceil(totalCount * 0.15);

      expect(getAdaptiveSampleSize(totalCount)).toBe(Math.max(25, Math.min(150, expectedSize)));
    });
  });

  describe("getAdaptiveSamplingConfig", () => {
    it("returns config with sampleSize and category counts", () => {
      const config = getAdaptiveSamplingConfig(100);

      expect(config).toHaveProperty("sampleSize");
      expect(config).toHaveProperty("topEngagedCount");
      expect(config).toHaveProperty("recentCount");
      expect(config).toHaveProperty("extremeRatingCount");
      expect(config).toHaveProperty("detailedCount");
    });

    it("distributes sample size evenly across categories", () => {
      const config = getAdaptiveSamplingConfig(100);
      const categorySize = Math.floor(config.sampleSize / 5);

      expect(config.topEngagedCount).toBe(categorySize);
      expect(config.recentCount).toBe(categorySize);
      expect(config.extremeRatingCount).toBe(categorySize);
      expect(config.detailedCount).toBe(categorySize);
    });

    it("scales category counts with total count", () => {
      const smallConfig = getAdaptiveSamplingConfig(100);
      const largeConfig = getAdaptiveSamplingConfig(1000);

      expect(largeConfig.topEngagedCount ?? 0).toBeGreaterThan(smallConfig.topEngagedCount ?? 0);
      expect(largeConfig.sampleSize).toBeGreaterThan(smallConfig.sampleSize);
    });

    it("respects MIN and MAX sample size bounds", () => {
      const configSmall = getAdaptiveSamplingConfig(50);
      const configLarge = getAdaptiveSamplingConfig(10000);

      expect(configSmall.sampleSize).toBeGreaterThanOrEqual(AI_BATCH_CONFIG.MIN_SAMPLE_SIZE);
      expect(configLarge.sampleSize).toBeLessThanOrEqual(AI_BATCH_CONFIG.MAX_SAMPLE_SIZE);
    });
  });
});
