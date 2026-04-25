import { describe, it, expect } from "vitest";
import {
  CADENCE_MATRIX,
  PLATFORM_VELOCITY,
  getRequiredCadenceMinutes,
  isCadenceElapsed,
} from "@/lib/scan-cadence";
import { ALL_PLATFORMS } from "@/lib/plans";

describe("scan-cadence matrix", () => {
  it("Free tier is flat 24h on all velocities", () => {
    expect(CADENCE_MATRIX.free.fast).toBe(24 * 60);
    expect(CADENCE_MATRIX.free.medium).toBe(24 * 60);
    expect(CADENCE_MATRIX.free.slow).toBe(24 * 60);
  });

  it("Growth tier is fastest", () => {
    expect(CADENCE_MATRIX.growth.fast).toBe(3 * 60);
    expect(CADENCE_MATRIX.growth.medium).toBe(4 * 60);
    expect(CADENCE_MATRIX.growth.slow).toBe(8 * 60);
  });

  it("All 16 platforms have a velocity classification", () => {
    expect(ALL_PLATFORMS.length).toBe(16);
    for (const p of ALL_PLATFORMS) {
      expect(PLATFORM_VELOCITY[p]).toBeDefined();
    }
  });

  it("getRequiredCadenceMinutes returns matrix values", () => {
    expect(getRequiredCadenceMinutes("growth", "reddit")).toBe(180); // fast 3h
    expect(getRequiredCadenceMinutes("solo", "trustpilot")).toBe(1440); // slow 24h
    expect(getRequiredCadenceMinutes("scale", "github")).toBe(480); // medium 8h
  });

  it("isCadenceElapsed returns true on first scan (null lastCheckedAt)", () => {
    expect(isCadenceElapsed("growth", "reddit", null)).toBe(true);
  });

  it("isCadenceElapsed respects cadence", () => {
    const justNow = new Date();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60_000);
    expect(isCadenceElapsed("growth", "reddit", justNow)).toBe(false); // 0 < 3h
    expect(isCadenceElapsed("growth", "reddit", fourHoursAgo)).toBe(true); // 4h > 3h
  });

  it("Higher tier always gets equal or faster cadence than lower tier", () => {
    const tiers = ["free", "solo", "scale", "growth"] as const;
    const velocities = ["fast", "medium", "slow"] as const;
    for (const v of velocities) {
      for (let i = 0; i < tiers.length - 1; i++) {
        const lower = CADENCE_MATRIX[tiers[i]][v];
        const higher = CADENCE_MATRIX[tiers[i + 1]][v];
        expect(higher).toBeLessThanOrEqual(lower);
      }
    }
  });

  it("isCadenceElapsed accepts string dates from serialized step.run output", () => {
    const fourHoursAgoIso = new Date(Date.now() - 4 * 60 * 60_000).toISOString();
    expect(isCadenceElapsed("growth", "reddit", fourHoursAgoIso)).toBe(true);
    const oneHourAgoIso = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(isCadenceElapsed("growth", "reddit", oneHourAgoIso)).toBe(false);
  });
});
