/**
 * Smart sampling algorithm for selecting representative items from large datasets
 * Used for cost-efficient batch AI analysis
 */

export interface SampleableItem {
  id: string;
  content: string;
  title?: string;
  engagement?: number; // upvotes, stars, likes, etc.
  rating?: number; // 1-5 star rating if available
  createdAt?: Date;
}

export interface SamplingConfig {
  /** Total number of items to sample */
  sampleSize: number;
  /** How many high-engagement items to prioritize */
  topEngagedCount?: number;
  /** How many recent items to include */
  recentCount?: number;
  /** How many items with extreme ratings (low) to include */
  extremeRatingCount?: number;
  /** How many long/detailed items to include */
  detailedCount?: number;
}

const DEFAULT_CONFIG: SamplingConfig = {
  sampleSize: 25,
  topEngagedCount: 5,
  recentCount: 5,
  extremeRatingCount: 5,
  detailedCount: 5,
};

/**
 * Select a representative sample from a large dataset using multiple heuristics
 *
 * Strategy:
 * 1. Top engaged items (highest upvotes/stars/replies) - most impactful voices
 * 2. Most recent items - freshest opinions
 * 3. Extreme ratings (lowest) - catch complaints and issues
 * 4. Longest content - most detailed/substantive feedback
 * 5. Random sample - unbiased representation
 *
 * This approach ensures we capture:
 * - Popular opinions (high engagement)
 * - Current trends (recent)
 * - Complaints/issues (low ratings)
 * - Detailed feedback (long content)
 * - Statistical representation (random)
 */
export function selectRepresentativeSample<T extends SampleableItem>(
  items: T[],
  config: Partial<SamplingConfig> = {}
): T[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (items.length <= cfg.sampleSize) {
    return items;
  }

  const selectedIds = new Set<string>();
  const selected: T[] = [];

  const addItem = (item: T) => {
    if (!selectedIds.has(item.id)) {
      selectedIds.add(item.id);
      selected.push(item);
    }
  };

  // 1. Top engaged items (highest engagement score)
  const byEngagement = [...items]
    .filter((i) => i.engagement !== undefined)
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0));

  byEngagement.slice(0, cfg.topEngagedCount || 5).forEach(addItem);

  // 2. Most recent items
  const byDate = [...items]
    .filter((i) => i.createdAt)
    .sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || 0);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

  byDate.slice(0, cfg.recentCount || 5).forEach(addItem);

  // 3. Extreme ratings (lowest first - catch complaints)
  const byRating = [...items]
    .filter((i) => i.rating !== undefined)
    .sort((a, b) => (a.rating || 5) - (b.rating || 5));

  byRating.slice(0, cfg.extremeRatingCount || 5).forEach(addItem);

  // 4. Longest content (most detailed feedback)
  const byLength = [...items].sort(
    (a, b) => (b.content?.length || 0) - (a.content?.length || 0)
  );

  byLength.slice(0, cfg.detailedCount || 5).forEach(addItem);

  // 5. Random sample to fill remaining slots
  const remaining = cfg.sampleSize - selected.length;
  if (remaining > 0) {
    const unselected = items.filter((i) => !selectedIds.has(i.id));
    const shuffled = shuffleArray(unselected);
    shuffled.slice(0, remaining).forEach(addItem);
  }

  return selected;
}

/**
 * Fisher-Yates shuffle for unbiased random selection
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * AI batch analysis configuration
 */
export const AI_BATCH_CONFIG = {
  /** Number of results that triggers batch mode instead of per-item analysis */
  BATCH_THRESHOLD: 50,
  /** How many items to sample for batch analysis */
  BATCH_SAMPLE_SIZE: 25,
  /** Model to use for batch analysis (use cheap/fast model) */
  BATCH_MODEL: "google/gemini-2.5-flash",
} as const;
