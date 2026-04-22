/**
 * Trustpilot Integration Module
 *
 * Primary: Apify happitap/trustpilot-scraper (direct scrape, no SerpApi §1201 exposure)
 * Fallback: Serper site:trustpilot.com search (legacy path — SERP DMCA risk)
 *
 * Rationale: .mdmp/apify-platform-cost-audit-2026-04-21.md Decision Log.
 * Kept as a fallback chain (not a hard cutover) while we collect one week of
 * telemetry on Apify reliability. The happitap actor has 87 users / 22 MAU /
 * last-modified 4 months — thin. If Apify proves reliable, delete the Serper
 * fallback in a follow-up. If not, revisit actor choice before burning more
 * engineering time on the migration.
 */

import { fetchTrustpilotReviews, isApifyConfigured } from "@/lib/apify";
import { searchTrustpilotSerper, isSerperConfigured } from "@/lib/serper";
import type { TrustpilotReviewItem } from "@/lib/serper";
import { logger } from "@/lib/logger";

export type { TrustpilotReviewItem };

export type TrustpilotSource = "apify" | "serper" | "none";

export interface TrustpilotFetchResult {
  items: TrustpilotReviewItem[];
  source: TrustpilotSource;
}

/**
 * Fetch Trustpilot reviews with an Apify-primary, Serper-fallback chain.
 *
 * Apify is tried first because it does not inherit the Reddit v. SerpApi /
 * Google v. SerpApi §1201 legal exposure. Serper fires only if Apify errors
 * or returns zero items — so we always have a result path while validating
 * actor reliability.
 */
export async function fetchTrustpilotResilient(
  companyUrlOrKeyword: string,
  limit: number = 20
): Promise<TrustpilotFetchResult> {
  // Primary: Apify happitap actor
  if (isApifyConfigured()) {
    const start = Date.now();
    try {
      const reviews = await fetchTrustpilotReviews(companyUrlOrKeyword, limit);
      if (reviews.length > 0) {
        logger.info("[Trustpilot] apify ok", {
          input: companyUrlOrKeyword,
          count: reviews.length,
          ms: Date.now() - start,
        });
        return { items: reviews, source: "apify" };
      }
      logger.warn("[Trustpilot] apify returned 0 — falling back to serper", {
        input: companyUrlOrKeyword,
        ms: Date.now() - start,
      });
    } catch (error) {
      logger.error("[Trustpilot] apify failed — falling back to serper", {
        input: companyUrlOrKeyword,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - start,
      });
    }
  }

  // Fallback: Serper site:trustpilot.com search
  if (isSerperConfigured()) {
    const start = Date.now();
    try {
      const reviews = await searchTrustpilotSerper(companyUrlOrKeyword, limit);
      logger.info("[Trustpilot] serper fallback", {
        input: companyUrlOrKeyword,
        count: reviews.length,
        ms: Date.now() - start,
      });
      return { items: reviews, source: "serper" };
    } catch (error) {
      logger.error("[Trustpilot] serper fallback failed", {
        input: companyUrlOrKeyword,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - start,
      });
    }
  }

  return { items: [], source: "none" };
}

export function isTrustpilotConfigured(): boolean {
  return isApifyConfigured() || isSerperConfigured();
}
