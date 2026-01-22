/**
 * Author Influence Scoring
 *
 * Calculates an influence score (0-100) for authors based on:
 * - Platform reputation (karma, followers)
 * - Account age (older = more established)
 * - Average engagement on posts
 * - Post frequency
 */

import { db, authorProfiles } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

// Platform type matching the database enum
type Platform =
  | "reddit"
  | "hackernews"
  | "producthunt"
  | "devto"
  | "googlereviews"
  | "trustpilot"
  | "appstore"
  | "playstore"
  | "quora";

export interface AuthorData {
  platform: Platform;
  username: string;
  karma?: number;
  accountAgeDays?: number;
  postEngagement?: number; // Upvotes + comments on this post
}

export interface InfluenceScore {
  total: number; // 0-100
  factors: {
    karma: number; // 0-30
    accountAge: number; // 0-20
    engagement: number; // 0-30
    activity: number; // 0-20
  };
  tier: "influencer" | "established" | "active" | "new";
}

/**
 * Calculate karma score component (0-30 points)
 */
function calculateKarmaScore(karma: number | undefined, platform: Platform): number {
  if (!karma) return 0;

  // Different platforms have different karma scales
  const thresholds: Record<Platform, { low: number; medium: number; high: number }> = {
    reddit: { low: 1000, medium: 10000, high: 100000 },
    hackernews: { low: 100, medium: 500, high: 2000 },
    producthunt: { low: 50, medium: 200, high: 1000 },
    devto: { low: 100, medium: 500, high: 2000 },
    quora: { low: 500, medium: 5000, high: 50000 },
    googlereviews: { low: 10, medium: 50, high: 200 },
    trustpilot: { low: 5, medium: 20, high: 100 },
    appstore: { low: 5, medium: 20, high: 100 },
    playstore: { low: 5, medium: 20, high: 100 },
  };

  const { low, medium, high } = thresholds[platform] || { low: 100, medium: 1000, high: 10000 };

  if (karma >= high) return 30;
  if (karma >= medium) return 20 + ((karma - medium) / (high - medium)) * 10;
  if (karma >= low) return 10 + ((karma - low) / (medium - low)) * 10;
  return (karma / low) * 10;
}

/**
 * Calculate account age score component (0-20 points)
 */
function calculateAccountAgeScore(ageDays: number | undefined): number {
  if (!ageDays) return 5; // Default for unknown

  // Account age thresholds (in days)
  if (ageDays >= 1825) return 20; // 5+ years
  if (ageDays >= 730) return 15; // 2+ years
  if (ageDays >= 365) return 10; // 1+ year
  if (ageDays >= 90) return 5; // 3+ months
  return Math.max(1, Math.floor(ageDays / 18)); // 0-5 for new accounts
}

/**
 * Calculate engagement score component (0-30 points)
 */
function calculateEngagementScore(
  avgEngagement: number | undefined,
  currentEngagement: number | undefined,
  platform: Platform
): number {
  const engagement = currentEngagement ?? avgEngagement ?? 0;

  // Different platforms have different engagement scales
  const thresholds: Record<Platform, { low: number; medium: number; high: number }> = {
    reddit: { low: 10, medium: 100, high: 1000 },
    hackernews: { low: 5, medium: 50, high: 500 },
    producthunt: { low: 5, medium: 50, high: 200 },
    devto: { low: 5, medium: 50, high: 500 },
    quora: { low: 5, medium: 50, high: 500 },
    googlereviews: { low: 2, medium: 10, high: 50 },
    trustpilot: { low: 2, medium: 10, high: 50 },
    appstore: { low: 2, medium: 10, high: 50 },
    playstore: { low: 2, medium: 10, high: 50 },
  };

  const { low, medium, high } = thresholds[platform] || { low: 5, medium: 50, high: 500 };

  if (engagement >= high) return 30;
  if (engagement >= medium) return 20 + ((engagement - medium) / (high - medium)) * 10;
  if (engagement >= low) return 10 + ((engagement - low) / (medium - low)) * 10;
  return (engagement / low) * 10;
}

/**
 * Calculate activity score component (0-20 points)
 */
function calculateActivityScore(postCount: number | undefined): number {
  if (!postCount) return 5; // Default

  if (postCount >= 1000) return 20;
  if (postCount >= 100) return 15;
  if (postCount >= 20) return 10;
  if (postCount >= 5) return 5;
  return Math.max(1, postCount);
}

/**
 * Determine influence tier based on total score
 */
function determineTier(score: number): InfluenceScore["tier"] {
  if (score >= 70) return "influencer";
  if (score >= 50) return "established";
  if (score >= 25) return "active";
  return "new";
}

/**
 * Calculate influence score for an author
 */
export function calculateInfluenceScore(
  authorData: AuthorData,
  storedProfile?: {
    karma?: number | null;
    accountAgeDays?: number | null;
    avgEngagement?: number | null;
    postCount?: number | null;
  }
): InfluenceScore {
  const karma = authorData.karma ?? storedProfile?.karma ?? undefined;
  const accountAgeDays = authorData.accountAgeDays ?? storedProfile?.accountAgeDays ?? undefined;
  const avgEngagement = storedProfile?.avgEngagement ?? undefined;
  const postCount = storedProfile?.postCount ?? undefined;

  const factors = {
    karma: Math.round(calculateKarmaScore(karma, authorData.platform)),
    accountAge: Math.round(calculateAccountAgeScore(accountAgeDays)),
    engagement: Math.round(
      calculateEngagementScore(avgEngagement, authorData.postEngagement, authorData.platform)
    ),
    activity: Math.round(calculateActivityScore(postCount)),
  };

  const total = Math.min(100, factors.karma + factors.accountAge + factors.engagement + factors.activity);

  return {
    total: Math.round(total),
    factors,
    tier: determineTier(total),
  };
}

/**
 * Get or create an author profile
 */
export async function getOrCreateAuthorProfile(
  platform: Platform,
  username: string
): Promise<typeof authorProfiles.$inferSelect | null> {
  if (!username) return null;

  try {
    const existing = await db.query.authorProfiles.findFirst({
      where: and(
        eq(authorProfiles.platform, platform),
        eq(authorProfiles.username, username)
      ),
    });

    if (existing) return existing;

    // Create new profile with minimal data
    const [newProfile] = await db
      .insert(authorProfiles)
      .values({
        platform,
        username,
        postCount: 1,
      })
      .returning();

    return newProfile;
  } catch (error) {
    console.error("Error getting/creating author profile:", error);
    return null;
  }
}

/**
 * Update author profile with new data
 */
export async function updateAuthorProfile(
  platform: Platform,
  username: string,
  data: Partial<{
    karma: number;
    accountAgeDays: number;
    avgEngagement: number;
    postCount: number;
    influenceScore: number;
  }>
): Promise<void> {
  if (!username) return;

  try {
    await db
      .update(authorProfiles)
      .set({
        ...data,
        lastUpdatedAt: new Date(),
      })
      .where(
        and(
          eq(authorProfiles.platform, platform),
          eq(authorProfiles.username, username)
        )
      );
  } catch (error) {
    console.error("Error updating author profile:", error);
  }
}

/**
 * Get top influencers for a platform
 */
export async function getTopInfluencers(
  platform?: Platform,
  limit: number = 10
): Promise<Array<typeof authorProfiles.$inferSelect>> {
  try {
    const query = db.query.authorProfiles.findMany({
      where: platform ? eq(authorProfiles.platform, platform) : undefined,
      orderBy: [desc(authorProfiles.influenceScore)],
      limit,
    });

    return await query;
  } catch (error) {
    console.error("Error getting top influencers:", error);
    return [];
  }
}

/**
 * Calculate and store influence score for an author
 */
export async function processAuthorInfluence(
  platform: Platform,
  username: string,
  currentPostEngagement?: number,
  authorKarma?: number,
  accountAgeDays?: number
): Promise<InfluenceScore> {
  if (!username) {
    return {
      total: 0,
      factors: { karma: 0, accountAge: 0, engagement: 0, activity: 0 },
      tier: "new",
    };
  }

  // Get or create profile
  const profile = await getOrCreateAuthorProfile(platform, username);

  // Calculate score
  const score = calculateInfluenceScore(
    {
      platform,
      username,
      karma: authorKarma,
      accountAgeDays,
      postEngagement: currentPostEngagement,
    },
    profile ?? undefined
  );

  // Update profile with new score if we have new data
  if (profile && (authorKarma || currentPostEngagement)) {
    await updateAuthorProfile(platform, username, {
      ...(authorKarma !== undefined && { karma: authorKarma }),
      ...(accountAgeDays !== undefined && { accountAgeDays }),
      influenceScore: score.total,
      postCount: (profile.postCount ?? 0) + 1,
    });
  }

  return score;
}
