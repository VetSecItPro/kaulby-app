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

interface SamplingConfig {
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
  /** Minimum sample size (for small batches 50-100) */
  MIN_SAMPLE_SIZE: 25,
  /** Maximum sample size (cost cap for very large batches) */
  MAX_SAMPLE_SIZE: 150,
  /** Target coverage percentage for adaptive sampling (15% ensures good insight quality) */
  TARGET_COVERAGE_PERCENT: 15,
  /** Model to use for batch analysis (use cheap/fast model) */
  BATCH_MODEL: "google/gemini-2.5-flash",
} as const;

/**
 * Calculate adaptive sample size based on total count
 *
 * Strategy: Aim for ~10% coverage with diminishing returns at scale
 * - 50-100 results: 25 samples (25-50% coverage) - good baseline
 * - 100-250 results: 25-35 samples (10-25% coverage)
 * - 250-500 results: 35-50 samples (10-14% coverage)
 * - 500-1000 results: 50-75 samples (7.5-10% coverage)
 * - 1000+ results: 75-100 samples (cap for cost control)
 *
 * Cost estimate (Gemini 2.5 Flash):
 * - 25 samples: ~$0.10-0.15
 * - 50 samples: ~$0.20-0.25
 * - 75 samples: ~$0.30-0.40
 * - 100 samples: ~$0.40-0.50
 *
 * vs Individual analysis: 500 results × $0.02 = $10.00 (97% savings!)
 */
export function getAdaptiveSampleSize(totalCount: number): number {
  const { MIN_SAMPLE_SIZE, MAX_SAMPLE_SIZE, TARGET_COVERAGE_PERCENT } = AI_BATCH_CONFIG;

  // Calculate target based on percentage
  const targetSize = Math.ceil(totalCount * (TARGET_COVERAGE_PERCENT / 100));

  // Apply bounds
  return Math.max(MIN_SAMPLE_SIZE, Math.min(MAX_SAMPLE_SIZE, targetSize));
}

/**
 * Get adaptive sampling configuration that scales category counts proportionally
 *
 * Categories (each gets ~20% of sample size):
 * 1. Top engaged - most impactful voices
 * 2. Most recent - current trends
 * 3. Extreme ratings - complaints/issues
 * 4. Detailed content - substantive feedback
 * 5. Random - statistical representation
 */
export function getAdaptiveSamplingConfig(totalCount: number): SamplingConfig {
  const sampleSize = getAdaptiveSampleSize(totalCount);

  // Each category gets ~20% of samples (4 explicit + random fills the rest)
  const categorySize = Math.floor(sampleSize / 5);

  return {
    sampleSize,
    topEngagedCount: categorySize,
    recentCount: categorySize,
    extremeRatingCount: categorySize,
    detailedCount: categorySize,
    // Note: Random sampling automatically fills remaining slots in selectRepresentativeSample()
  };
}

