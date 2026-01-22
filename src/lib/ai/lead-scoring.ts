/**
 * Lead Scoring Algorithm
 *
 * Calculates a lead score (0-100) for results based on multiple factors:
 * - Intent signals (40%) - phrases indicating buying intent
 * - Engagement (20%) - upvotes, comments indicate reach
 * - Recency (15%) - newer posts are fresher leads
 * - Author quality (15%) - karma, account age
 * - Category (10%) - solution requests score higher
 */

export interface LeadScoreFactors {
  intent: number;        // 0-40
  engagement: number;    // 0-20
  recency: number;       // 0-15
  authorQuality: number; // 0-15
  category: number;      // 0-10
  total: number;         // 0-100
}

export interface LeadScoreInput {
  /** Post title */
  title: string;
  /** Post content/body */
  content?: string | null;
  /** Conversation category from AI analysis */
  conversationCategory?: string | null;
  /** Engagement score (upvotes + comments) */
  engagementScore?: number | null;
  /** When the post was created */
  postedAt?: Date | null;
  /** Author's karma/reputation */
  authorKarma?: number | null;
  /** Author's account age in days */
  authorAccountAgeDays?: number | null;
  /** Platform (for platform-specific adjustments) */
  platform?: string;
}

/**
 * High-intent phrases that indicate buying signals
 */
const HIGH_INTENT_PHRASES = [
  // Direct purchase intent
  "looking for",
  "need a tool",
  "need a solution",
  "recommend a",
  "recommend me",
  "suggestions for",
  "best tool for",
  "best software for",
  "best app for",
  "anyone use",
  "anyone using",
  "what do you use for",
  "what should i use",
  "what would you recommend",
  "can anyone recommend",
  "trying to find",
  "searching for",
  "in the market for",
  "want to buy",
  "ready to pay",
  "willing to pay",
  "budget for",

  // Comparison/evaluation
  "alternatives to",
  "alternative to",
  "vs",
  "compared to",
  "comparison",
  "which is better",
  "should i switch",
  "thinking of switching",
  "migrating from",

  // Problem statements (implied need)
  "frustrated with",
  "struggling with",
  "pain point",
  "problem with",
  "issue with",
  "challenge with",
  "fed up with",
  "tired of",
];

/**
 * Medium-intent phrases
 */
const MEDIUM_INTENT_PHRASES = [
  "how do you",
  "how does",
  "is there a way to",
  "does anyone know",
  "has anyone tried",
  "thoughts on",
  "opinions on",
  "experience with",
  "review of",
  "feedback on",
];

/**
 * Calculate intent score (0-40)
 */
function calculateIntentScore(title: string, content?: string | null): number {
  const text = `${title} ${content || ""}`.toLowerCase();

  // Check for high-intent phrases
  let highIntentMatches = 0;
  for (const phrase of HIGH_INTENT_PHRASES) {
    if (text.includes(phrase.toLowerCase())) {
      highIntentMatches++;
    }
  }

  // Check for medium-intent phrases
  let mediumIntentMatches = 0;
  for (const phrase of MEDIUM_INTENT_PHRASES) {
    if (text.includes(phrase.toLowerCase())) {
      mediumIntentMatches++;
    }
  }

  // Score calculation
  // High intent: 15 points for first match, 5 for each additional (max 30)
  // Medium intent: 5 points for first match, 2 for each additional (max 10)
  let score = 0;

  if (highIntentMatches > 0) {
    score += 15 + Math.min((highIntentMatches - 1) * 5, 15);
  }

  if (mediumIntentMatches > 0) {
    score += 5 + Math.min((mediumIntentMatches - 1) * 2, 5);
  }

  return Math.min(score, 40);
}

/**
 * Calculate engagement score (0-20)
 */
function calculateEngagementScore(engagementScore?: number | null): number {
  if (!engagementScore || engagementScore <= 0) return 0;

  // Logarithmic scale - high engagement matters but diminishing returns
  // 0-10: 0-5 points
  // 10-50: 5-10 points
  // 50-100: 10-15 points
  // 100+: 15-20 points
  if (engagementScore <= 10) {
    return Math.round((engagementScore / 10) * 5);
  } else if (engagementScore <= 50) {
    return 5 + Math.round(((engagementScore - 10) / 40) * 5);
  } else if (engagementScore <= 100) {
    return 10 + Math.round(((engagementScore - 50) / 50) * 5);
  } else {
    return Math.min(15 + Math.round(Math.log10(engagementScore - 100) * 2), 20);
  }
}

/**
 * Calculate recency score (0-15)
 */
function calculateRecencyScore(postedAt?: Date | null): number {
  if (!postedAt) return 7; // Default to middle if unknown

  const now = new Date();
  const hoursOld = (now.getTime() - postedAt.getTime()) / (1000 * 60 * 60);

  // Score based on age
  // < 24 hours: 15 points
  // 1-3 days: 12 points
  // 3-7 days: 9 points
  // 7-14 days: 6 points
  // 14-30 days: 3 points
  // 30+ days: 1 point
  if (hoursOld < 24) {
    return 15;
  } else if (hoursOld < 72) {
    return 12;
  } else if (hoursOld < 168) {
    return 9;
  } else if (hoursOld < 336) {
    return 6;
  } else if (hoursOld < 720) {
    return 3;
  } else {
    return 1;
  }
}

/**
 * Calculate author quality score (0-15)
 */
function calculateAuthorQualityScore(
  authorKarma?: number | null,
  authorAccountAgeDays?: number | null
): number {
  // Default to middle if unknown
  if (authorKarma === null && authorAccountAgeDays === null) {
    return 7;
  }

  let score = 0;

  // Karma score (0-10)
  if (authorKarma !== null && authorKarma !== undefined) {
    if (authorKarma >= 10000) score += 10;
    else if (authorKarma >= 5000) score += 8;
    else if (authorKarma >= 1000) score += 6;
    else if (authorKarma >= 500) score += 4;
    else if (authorKarma >= 100) score += 2;
    else score += 1;
  } else {
    score += 5; // Default
  }

  // Account age score (0-5)
  if (authorAccountAgeDays !== null && authorAccountAgeDays !== undefined) {
    if (authorAccountAgeDays >= 365 * 2) score += 5; // 2+ years
    else if (authorAccountAgeDays >= 365) score += 4; // 1+ year
    else if (authorAccountAgeDays >= 180) score += 3; // 6+ months
    else if (authorAccountAgeDays >= 30) score += 2; // 1+ month
    else score += 1;
  } else {
    score += 2; // Default
  }

  return Math.min(score, 15);
}

/**
 * Calculate category score (0-10)
 */
function calculateCategoryScore(conversationCategory?: string | null): number {
  switch (conversationCategory) {
    case "solution_request":
      return 10; // Highest - actively seeking solutions
    case "money_talk":
      return 8; // High - discussing budget/pricing
    case "pain_point":
      return 6; // Medium-high - has a problem
    case "advice_request":
      return 4; // Medium - seeking guidance
    case "hot_discussion":
      return 3; // Lower - high engagement but not necessarily buying intent
    default:
      return 2; // Unknown or general
  }
}

/**
 * Calculate complete lead score
 */
export function calculateLeadScore(input: LeadScoreInput): LeadScoreFactors {
  const intent = calculateIntentScore(input.title, input.content);
  const engagement = calculateEngagementScore(input.engagementScore);
  const recency = calculateRecencyScore(input.postedAt);
  const authorQuality = calculateAuthorQualityScore(
    input.authorKarma,
    input.authorAccountAgeDays
  );
  const category = calculateCategoryScore(input.conversationCategory);

  const total = intent + engagement + recency + authorQuality + category;

  return {
    intent,
    engagement,
    recency,
    authorQuality,
    category,
    total,
  };
}

/**
 * Get lead score label based on total score
 */
export function getLeadScoreLabel(score: number): {
  label: string;
  color: string;
  emoji: string;
} {
  if (score >= 70) {
    return { label: "Hot Lead", color: "text-orange-600 dark:text-orange-400", emoji: "🔥" };
  } else if (score >= 50) {
    return { label: "Warm Lead", color: "text-yellow-600 dark:text-yellow-400", emoji: "⭐" };
  } else if (score >= 30) {
    return { label: "Cool Lead", color: "text-blue-600 dark:text-blue-400", emoji: "❄️" };
  } else {
    return { label: "Cold", color: "text-gray-600 dark:text-gray-400", emoji: "💤" };
  }
}

/**
 * Check if a lead score indicates high intent
 */
export function isHighIntentLead(score: number): boolean {
  return score >= 50;
}

/**
 * Check if a lead score indicates very high intent (hot lead)
 */
export function isHotLead(score: number): boolean {
  return score >= 70;
}
