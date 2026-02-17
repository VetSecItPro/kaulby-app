/**
 * Default detection keywords per conversation category.
 *
 * These are seeded when a user first enables custom detection keywords.
 * Users can add/remove keywords per category to tune their detection pipeline.
 * The keywords are checked BEFORE AI analysis — if a keyword match is found,
 * the conversation category is assigned directly without an AI call (cost savings).
 */

export type DetectionCategory =
  | "pain_point"
  | "solution_request"
  | "advice_request"
  | "money_talk"
  | "hot_discussion";

export interface DetectionCategoryConfig {
  category: DetectionCategory;
  label: string;
  description: string;
  defaultKeywords: string[];
}

export const DETECTION_CATEGORIES: DetectionCategoryConfig[] = [
  {
    category: "solution_request",
    label: "Solution Requests",
    description: "Active buying intent — users seeking recommendations, alternatives, or tools.",
    defaultKeywords: [
      "looking for a tool",
      "recommend a",
      "alternative to",
      "best tool for",
      "what do you use for",
      "anyone tried",
      "need a solution",
      "switching from",
      "evaluating",
      "comparison",
      "which is better",
      "suggestions for",
      "replacement for",
      "migrate from",
      "looking to buy",
    ],
  },
  {
    category: "money_talk",
    label: "Money Talk",
    description: "Price/value discussions — budget decisions, ROI concerns, cost comparisons.",
    defaultKeywords: [
      "too expensive",
      "is it worth",
      "cheaper than",
      "free alternative",
      "budget for",
      "pricing",
      "cost of",
      "roi",
      "return on investment",
      "price increase",
      "not worth the money",
      "overpriced",
      "affordable",
      "per month",
      "per seat",
    ],
  },
  {
    category: "pain_point",
    label: "Pain Points",
    description: "Frustration or problem descriptions — shows unmet needs in your market.",
    defaultKeywords: [
      "so frustrating",
      "doesn't work",
      "broken",
      "sick of",
      "can't believe",
      "hate when",
      "worst experience",
      "waste of time",
      "terrible",
      "nightmare",
      "impossible to",
      "keeps crashing",
      "no support",
      "unacceptable",
      "deal breaker",
    ],
  },
  {
    category: "advice_request",
    label: "Advice Requests",
    description: "Users seeking guidance — engagement opportunity to build authority.",
    defaultKeywords: [
      "how do i",
      "what's the best way",
      "any tips for",
      "help me understand",
      "beginner question",
      "getting started with",
      "best practices",
      "how to set up",
      "tutorial for",
      "guide for",
      "eli5",
      "can someone explain",
      "new to",
      "first time",
      "step by step",
    ],
  },
  {
    category: "hot_discussion",
    label: "Hot Discussions",
    description: "High engagement content — visibility opportunities for your brand.",
    defaultKeywords: [
      "unpopular opinion",
      "controversial",
      "hot take",
      "debate",
      "what do you think",
      "am i the only one",
      "rant",
      "change my mind",
      "overrated",
      "underrated",
      "fight me",
      "thoughts on",
      "honest opinion",
      "does anyone else",
      "am i wrong",
    ],
  },
];

/**
 * Get default keywords for a specific category
 */
export function getDefaultKeywords(category: DetectionCategory): string[] {
  const config = DETECTION_CATEGORIES.find((c) => c.category === category);
  return config?.defaultKeywords || [];
}

/**
 * Get all default keywords as a map
 */
export function getAllDefaultKeywords(): Record<DetectionCategory, string[]> {
  return DETECTION_CATEGORIES.reduce(
    (acc, config) => {
      acc[config.category] = config.defaultKeywords;
      return acc;
    },
    {} as Record<DetectionCategory, string[]>
  );
}
