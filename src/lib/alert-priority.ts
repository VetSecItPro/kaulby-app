/**
 * Alert priority weighting (Task 2.5).
 *
 * WHY: Before this, alerts fired chronologically — a neutral low-engagement
 * post shared equal billing with a 1,000-upvote negative complaint. The
 * monitoring audit surfaced this as a signal-to-noise problem: the user's
 * eye is drawn to whatever is at the top of the email, and chronological
 * ordering buries the most actionable item somewhere in the middle.
 *
 * This module computes a scalar priority per result so the alert dispatcher
 * can sort DESC before rendering. It does NOT change WHICH results fire;
 * it only reorders the list passed to the email template.
 *
 * Formula:
 *   priority = sentimentWeight * log(1 + engagement) * confidence * (1 + leadBoost)
 *
 * Why these factors:
 *   - sentiment: negative > positive > neutral/null. Negative feedback is
 *     the highest-leverage signal for a monitoring tool — it's where a
 *     customer is actively asking for a fix.
 *   - log(1 + engagement): prevents a single viral post from dominating
 *     by many orders of magnitude. A 10,000-upvote post beats a 10-upvote
 *     post, but not by 1,000x.
 *   - confidence: down-weights noisy AI categorizations. Null falls back
 *     to 0.5 (neutral), not 0, so missing confidence doesn't zero-out a
 *     row that's otherwise high-signal.
 *   - leadBoost: already a 0–100 composite. Normalized to 0–1 and added
 *     as a multiplier so a hot lead floats up without swamping sentiment.
 */

export type AlertPriorityInput = {
  sentiment: "positive" | "negative" | "neutral" | null;
  engagementScore: number | null;
  conversationCategoryConfidence: number | null;
  leadScore?: number | null;
};

export function calculateAlertPriority(result: AlertPriorityInput): number {
  const sentimentWeight =
    result.sentiment === "negative"
      ? 1.5
      : result.sentiment === "positive"
        ? 1.0
        : 0.7; // neutral or null — still fires, just ranked lower
  const engagement = Math.log(1 + (result.engagementScore ?? 0));
  const confidence = result.conversationCategoryConfidence ?? 0.5;
  const leadBoost = (result.leadScore ?? 0) / 100; // 0..1
  return sentimentWeight * engagement * confidence * (1 + leadBoost);
}

/**
 * Sort a list of alert results by priority DESC. Stable ties break on
 * createdAt DESC (newer first) so the ordering is deterministic across
 * runs — important for snapshot-style digest email QA.
 *
 * Accepts a structural superset so any row type with the required fields
 * works (inferred Drizzle row, notification mapped shape, test fixture).
 */
/**
 * createdAt may arrive as a Date (in-memory) or as an ISO string (JSON-ified
 * from Inngest step payloads / Drizzle row serialization). Normalize to ms.
 */
function toMs(v: Date | string | number | null | undefined): number {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function sortByAlertPriority<
  T extends AlertPriorityInput & {
    createdAt?: Date | string | number | null;
  },
>(resultsList: T[]): T[] {
  return [...resultsList]
    .map((r, idx) => ({ r, idx, p: calculateAlertPriority(r) }))
    .sort((a, b) => {
      if (b.p !== a.p) return b.p - a.p;
      const aTime = toMs(a.r.createdAt);
      const bTime = toMs(b.r.createdAt);
      if (bTime !== aTime) return bTime - aTime;
      // Final tie-breaker: preserve input order so sort is fully deterministic.
      return a.idx - b.idx;
    })
    .map((x) => x.r);
}
