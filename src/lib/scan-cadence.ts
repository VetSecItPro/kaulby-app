/**
 * Per-tier per-platform-velocity scan cadence matrix.
 *
 * Caps how often the SCHEDULED cron actually runs a monitor's scan
 * for a given user's plan. On-demand "scan now" is a separate path
 * with its own rate limits + monthly quotas; those are NOT gated here.
 *
 * Velocity classification rationale:
 * - Fast: time-sensitive content (HN/X stories die in hours; Reddit hot
 *   subs post 5-10/hr; brand crises emerge fast)
 * - Medium: dev/community content posts daily; some hourly bursts
 * - Slow: review platforms — reviews arrive daily, not hourly
 *
 * Why these specific cadences:
 * - Free tier flat 24h: clear value floor, zero cost concern
 * - Solo at 12h fast/medium / 24h slow: 1-2 scans/day on most platforms
 * - Scale at 6h fast / 8h medium / 12h slow: workday-friendly cadence
 * - Growth at 3h fast / 4h medium / 8h slow: premium freshness on the
 *   platforms where it actually matters; review platforms throttled
 *   because reviews don't post hourly anyway.
 *
 * NOTE: This matrix layers ON TOP of the existing tier-flat
 * `refreshDelayHours` gate in `shouldProcessMonitorWithPlan` (used by
 * non-cron paths). Cron uses BOTH gates — whichever is stricter wins.
 *
 * See docs/planning/kaulby-backlog.md (2026-04-24 tier-cadence section)
 * for the full rationale + tier-escape mitigations.
 */

import type { Platform, PlanKey } from "@/lib/plans";
import { normalizePlanKey } from "@/lib/plans";

export type Velocity = "fast" | "medium" | "slow";

export const PLATFORM_VELOCITY: Record<Platform, Velocity> = {
  hackernews: "fast",
  x: "fast",
  reddit: "fast",
  github: "medium",
  devto: "medium",
  hashnode: "medium",
  producthunt: "medium",
  youtube: "medium",
  indiehackers: "medium",
  trustpilot: "slow",
  g2: "slow",
  yelp: "slow",
  amazonreviews: "slow",
  appstore: "slow",
  playstore: "slow",
  googlereviews: "slow",
};

const HOUR_MIN = 60;

export const CADENCE_MATRIX: Record<PlanKey, Record<Velocity, number>> = {
  free: { fast: 24 * HOUR_MIN, medium: 24 * HOUR_MIN, slow: 24 * HOUR_MIN },
  solo: { fast: 12 * HOUR_MIN, medium: 12 * HOUR_MIN, slow: 24 * HOUR_MIN },
  scale: { fast: 6 * HOUR_MIN, medium: 8 * HOUR_MIN, slow: 12 * HOUR_MIN },
  growth: { fast: 3 * HOUR_MIN, medium: 4 * HOUR_MIN, slow: 8 * HOUR_MIN },
};

/**
 * Returns the minimum minutes that must elapse between scheduled scans
 * for a given user's plan + the platform being scanned.
 */
export function getRequiredCadenceMinutes(
  plan: PlanKey,
  platform: Platform,
): number {
  const velocity = PLATFORM_VELOCITY[platform];
  // Defensive: if a future Platform value is added without a velocity entry,
  // fall back to the slowest classification rather than crashing the cron.
  const safeVelocity: Velocity = velocity ?? "slow";
  const safePlan: PlanKey = normalizePlanKey(plan);
  return CADENCE_MATRIX[safePlan][safeVelocity];
}

/**
 * Returns true if a monitor's scheduled scan is due (cadence elapsed).
 * If lastCheckedAt is null → always due (first scan).
 */
export function isCadenceElapsed(
  plan: PlanKey,
  platform: Platform,
  lastCheckedAt: Date | string | null,
): boolean {
  if (!lastCheckedAt) return true;
  const lastCheckDate =
    typeof lastCheckedAt === "string" ? new Date(lastCheckedAt) : lastCheckedAt;
  if (Number.isNaN(lastCheckDate.getTime())) return true;
  const required = getRequiredCadenceMinutes(plan, platform);
  const elapsedMin = (Date.now() - lastCheckDate.getTime()) / 60_000;
  return elapsedMin >= required;
}
