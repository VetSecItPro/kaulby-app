# Kaulby Platform Optimization

## Task 1: Fix Monitor Form Platform Order

**Problem:** The monitor form currently groups platforms by category, which the user doesn't want.

**Solution:** Revert to a flat list with this specific order:
1. Reddit
2. Hacker News
3. Product Hunt
4. Quora
5. Trustpilot
6. G2
7. Google Reviews
8. Amazon Reviews
9. Yelp
10. App Store
11. Play Store
12. YouTube

**File:** `src/app/(dashboard)/dashboard/monitors/new/new-monitor-form.tsx`

**Changes:**
- Remove `PLATFORM_CATEGORIES` constant entirely
- Replace with flat `ALL_PLATFORMS` array in the specified order
- Update the UI rendering to show a simple grid instead of category sections

---

## Task 2: AI Cost Optimization for Large Review Volumes

**Problem:** Platforms like Amazon, YouTube, G2 can return 200-2000+ reviews/comments. Current implementation analyzes each result individually (~$0.02-0.05 per result for Pro, ~$0.20-0.50 for Team). This could cost $40-1000+ per bulk operation.

**User Requirement:** Provide sentiment intelligence without overtaxing AI costs. Use overall summaries with specific examples instead of per-item analysis.

### Current State Analysis

| Aspect | Current Implementation |
|--------|----------------------|
| AI Trigger | Per-result via Inngest event `content/analyze` |
| Pro Model | Gemini 2.5 Flash ($0.02-0.05/result) |
| Team Model | Claude Sonnet 4 ($0.20-0.50/result) |
| Analysis | 4 parallel calls: sentiment, pain points, summary, category |
| Concurrency | 5 concurrent AI calls max |
| Cost Tracking | `aiLogs` table with token usage |

### Proposed Solution: Smart Sampling + Batch Summary

**Strategy:** When a platform returns >50 results, instead of analyzing each one:

1. **Index all results** - Store in database without AI analysis
2. **Smart sample** - Select 20-30 representative results using heuristics
3. **Batch summarize** - Run one AI call on the sample to generate overall sentiment + key examples
4. **Store batch analysis** - Save summary at monitor level, not per-result

### Implementation Details

#### Phase A: Add Batch Analysis Mode

**New file:** `src/lib/ai/analyzers/batch-summary.ts`

```typescript
interface BatchSummaryInput {
  platformName: string;
  totalCount: number;
  sampleItems: Array<{
    title: string;
    content: string;
    engagement?: number;  // upvotes, stars, etc.
    date?: string;
  }>;
}

interface BatchSummaryResult {
  overallSentiment: "positive" | "negative" | "neutral" | "mixed";
  sentimentScore: number;  // -1.0 to 1.0
  sentimentBreakdown: {
    positive: number;  // percentage
    negative: number;
    neutral: number;
  };
  keyThemes: string[];  // ["pricing concerns", "great support", etc.]
  notableExamples: Array<{
    type: "positive" | "negative" | "insight";
    quote: string;
    reason: string;
  }>;
  actionableInsights: string[];
  summary: string;  // 2-3 sentence executive summary
}
```

**Prompt strategy:**
- Feed 20-30 representative items in one prompt
- Ask for overall sentiment distribution
- Request 3-5 notable examples with quotes
- Get actionable insights
- Total: ~2000-4000 tokens input, ~500 output = ~$0.10-0.20 per batch

#### Phase B: Smart Sampling Algorithm

**File:** `src/lib/ai/sampling.ts`

Selection heuristics (pick 20-30 items):
1. **Top engaged** - 5 highest engagement (upvotes, stars, replies)
2. **Recent** - 5 most recent
3. **Longest content** - 5 most detailed (likely more substantive)
4. **Random sample** - 10 random for unbiased representation
5. **Extreme ratings** - 5 with lowest ratings (if available) to catch complaints

#### Phase C: Modify Inngest Flow

**File:** `src/lib/inngest/functions/analyze-content.ts`

Add batch mode detection:

```typescript
// In monitor functions, after fetching results:
if (results.length > BATCH_THRESHOLD) {
  // Trigger batch analysis instead of per-item
  await inngest.send({
    name: "content/analyze-batch",
    data: {
      monitorId: monitor.id,
      userId: monitor.userId,
      platform: monitor.platform,
      resultIds: results.map(r => r.id),
      totalCount: results.length,
    },
  });
} else {
  // Existing per-item analysis for small batches
  for (const result of results) {
    await inngest.send({ name: "content/analyze", data: { resultId: result.id, userId: monitor.userId } });
  }
}
```

**New Inngest function:** `analyze-content-batch.ts`

#### Phase D: Database Changes

**Schema addition in `src/lib/db/schema.ts`:**

```typescript
// Add to monitors table
batchAnalysis: jsonb("batch_analysis"),  // Stores BatchSummaryResult
lastBatchAnalyzedAt: timestamp("last_batch_analyzed_at"),

// Add to results table
batchAnalyzed: boolean("batch_analyzed").default(false),  // True = part of batch, no individual analysis
```

#### Phase E: UI Updates

**Dashboard changes:**
- When viewing results from a batch-analyzed scan, show the batch summary card at top
- Individual results show platform-level sentiment badge (from batch)
- "Analyzed via batch sampling (25 of 2,341 reviews)" indicator

### Cost Comparison

| Scenario | Current Cost | With Batch Mode |
|----------|-------------|-----------------|
| 50 Amazon reviews | $1-2.50 | $1-2.50 (no change, under threshold) |
| 500 Amazon reviews | $10-25 | $0.15-0.30 (batch) |
| 2000 YouTube comments | $40-100 | $0.15-0.30 (batch) |
| 50,000 YouTube comments | $1000-2500 | $0.15-0.30 (batch) |

### Configuration

```typescript
// src/lib/ai/config.ts
export const AI_CONFIG = {
  BATCH_THRESHOLD: 50,          // Results above this trigger batch mode
  BATCH_SAMPLE_SIZE: 25,        // How many to sample for batch analysis
  BATCH_MODEL: "google/gemini-2.5-flash",  // Cheap model for batches
};
```

---

## Files to Modify

### Task 1 (Monitor Form Fix):
- `src/app/(dashboard)/dashboard/monitors/new/new-monitor-form.tsx` - Remove categories, use flat ordered list

### Task 2 (AI Cost Optimization):

**Create:**
- `src/lib/ai/analyzers/batch-summary.ts` - Batch analysis function
- `src/lib/ai/sampling.ts` - Smart sampling algorithm
- `src/lib/inngest/functions/analyze-content-batch.ts` - Batch analysis Inngest function

**Modify:**
- `src/lib/db/schema.ts` - Add batchAnalysis, batchAnalyzed fields
- `src/lib/inngest/functions/monitor-amazon.ts` - Add batch mode detection
- `src/lib/inngest/functions/monitor-youtube.ts` - Add batch mode detection
- `src/lib/inngest/functions/monitor-g2.ts` - Add batch mode detection
- `src/lib/inngest/functions/monitor-yelp.ts` - Add batch mode detection
- `src/lib/inngest/index.ts` - Export new batch function
- `src/components/dashboard/results-list.tsx` - Show batch summary UI

---

## Verification Plan

### Task 1:
1. Navigate to /dashboard/monitors/new
2. Verify all 12 platforms appear in flat list
3. Verify order matches: Reddit, HN, PH, Quora, Trustpilot, G2, Google, Amazon, Yelp, App Store, Play Store, YouTube
4. Verify Pro/Free badges still work correctly

### Task 2:
1. Create a monitor for Amazon/YouTube with URL that has 100+ reviews
2. Trigger manual scan
3. Verify batch analysis triggers (check Inngest dashboard)
4. Verify batch summary stored on monitor
5. Verify individual results marked as batch-analyzed
6. Verify UI shows batch summary card
7. Check aiLogs table - should show ~$0.15-0.30 instead of $10+

---

## Implementation Order

1. **Task 1 first** (quick fix)
2. **Task 2 Phase A-B** - Core batch analysis logic
3. **Task 2 Phase C** - Inngest integration
4. **Task 2 Phase D** - Database schema
5. **Task 2 Phase E** - UI updates
6. **Testing and verification**
