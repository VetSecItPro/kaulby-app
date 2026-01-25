/**
 * Community Stats Collection Job
 *
 * Collects and stores subreddit statistics for programmatic SEO pages.
 * Runs weekly to keep stats fresh without excessive API calls.
 *
 * Data collected:
 * - Member count
 * - Posts per day (activity level)
 * - Engagement rate (average upvotes + comments per post)
 */

import { inngest } from "../client";
import { db } from "@/lib/db";
import { communityGrowth } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// Top subreddits for business/startup monitoring (prioritized for SEO)
// These are the most valuable for Kaulby's target audience
const PRIORITY_SUBREDDITS = [
  // Business & Startups
  "startups", "entrepreneur", "smallbusiness", "SaaS", "startup",
  "venturecapital", "sweatystartup", "GrowthHacking", "EntrepreneurRideAlong",
  "Startups_Subterfuge", "sidehustle", "PassiveIncome", "ecommerce",

  // Product & Marketing
  "marketing", "socialmedia", "digital_marketing", "PPC", "SEO",
  "content_marketing", "emailmarketing", "CopyWriting", "advertising",
  "productdesign", "ProductManagement", "userexperience",

  // Technology & Dev
  "webdev", "programming", "javascript", "reactjs", "nextjs", "node",
  "Python", "golang", "rust", "devops", "sysadmin", "selfhosted",
  "machinelearning", "artificial", "ChatGPT", "LocalLLaMA",

  // Finance & Investing
  "personalfinance", "financialindependence", "investing", "stocks",
  "wallstreetbets", "CryptoCurrency", "Bitcoin", "ethereum",

  // Productivity & Tools
  "productivity", "Notion", "ObsidianMD", "LifeProTips", "getdisciplined",
  "todoist", "Airtable", "nocode", "lowcode",

  // Industry Verticals
  "realestateinvesting", "dropship", "FulfillmentByAmazon", "shopify",
  "Etsy", "AmazonSeller", "Flipping", "reselling",

  // Communities for feedback
  "SideProject", "IMadeThis", "AlphaAndBetaUsers", "indiebiz",
  "Lightbulb", "somebodymakethis", "AppIdeas", "startup_ideas",

  // Support & Discussion
  "Advice", "AskReddit", "explainlikeimfive", "NoStupidQuestions",
  "TooAfraidToAsk", "findareddit", "newtoreddit",
];

// Extended list - less priority but still valuable
const EXTENDED_SUBREDDITS = [
  // Tech-specific
  "typescript", "svelte", "vuejs", "angular", "flutter", "swift",
  "AndroidDev", "iOSProgramming", "gamedev", "godot", "unity3d",
  "aws", "googlecloud", "azure", "kubernetes", "docker",

  // Design
  "Design", "graphic_design", "UI_Design", "web_design", "Figma",

  // More business
  "consulting", "freelance", "WorkOnline", "digitalnomad", "remotework",
  "Entrepreneur30", "microsaas", "IndieHackers", "buildinpublic",

  // Tech discussion
  "technology", "Futurology", "hardware", "gadgets", "tech",
  "Hacking", "netsec", "cybersecurity", "privacytoolsIO",

  // Career
  "cscareerquestions", "jobs", "recruitinghell", "antiwork",
  "careerguidance", "findapath",

  // Finance extended
  "options", "pennystocks", "Daytrading", "StockMarket",
  "RealEstate", "landlord", "Homebuilding",

  // Hobby that overlap with business
  "photography", "videography", "podcasting", "Twitch", "youtube",
  "socialmediamarketing", "influencermarketing",
];

interface SubredditStats {
  subreddit: string;
  subscribers: number;
  activeUsers: number;
  description: string;
  created: number;
}

/**
 * Fetch subreddit info from Reddit's public API
 */
async function fetchSubredditInfo(subreddit: string): Promise<SubredditStats | null> {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/about.json`,
      {
        headers: {
          "User-Agent": "Kaulby/1.0 (community-stats-collector)",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[CommunityStats] Subreddit r/${subreddit} not found`);
        return null;
      }
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();
    const info = data.data;

    return {
      subreddit: info.display_name,
      subscribers: info.subscribers || 0,
      activeUsers: info.accounts_active || 0,
      description: info.public_description || info.description || "",
      created: info.created_utc || 0,
    };
  } catch (error) {
    console.error(`[CommunityStats] Error fetching r/${subreddit}:`, error);
    return null;
  }
}

/**
 * Estimate daily post count from subreddit activity
 */
async function estimatePostsPerDay(subreddit: string): Promise<number> {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/new.json?limit=100`,
      {
        headers: {
          "User-Agent": "Kaulby/1.0 (community-stats-collector)",
        },
      }
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    const posts = data.data?.children || [];

    if (posts.length < 2) {
      return posts.length;
    }

    // Calculate time span of the 100 most recent posts
    const newestPost = posts[0]?.data?.created_utc || 0;
    const oldestPost = posts[posts.length - 1]?.data?.created_utc || 0;
    const timeSpanHours = (newestPost - oldestPost) / 3600;

    if (timeSpanHours <= 0) {
      return 0;
    }

    // Extrapolate to posts per day
    const postsPerHour = posts.length / timeSpanHours;
    return Math.round(postsPerHour * 24);
  } catch {
    return 0;
  }
}

/**
 * Calculate engagement rate from recent posts
 */
async function calculateEngagementRate(subreddit: string): Promise<number> {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: {
          "User-Agent": "Kaulby/1.0 (community-stats-collector)",
        },
      }
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    const posts = data.data?.children || [];

    if (posts.length === 0) {
      return 0;
    }

    // Calculate average engagement (upvotes + comments)
    let totalEngagement = 0;
    for (const post of posts) {
      const score = post.data?.score || 0;
      const comments = post.data?.num_comments || 0;
      totalEngagement += score + comments;
    }

    return Math.round(totalEngagement / posts.length);
  } catch {
    return 0;
  }
}

/**
 * Store subreddit stats in the database
 */
async function storeStats(
  subreddit: string,
  memberCount: number,
  postsPerDay: number,
  engagementRate: number
): Promise<void> {
  try {
    await db.insert(communityGrowth).values({
      platform: "reddit",
      identifier: `r/${subreddit}`,
      memberCount,
      postCountDaily: postsPerDay,
      engagementRate,
    });
  } catch (error) {
    console.error(`[CommunityStats] Error storing stats for r/${subreddit}:`, error);
  }
}

/**
 * Get the most recent stats for a subreddit
 */
export async function getLatestStats(subreddit: string) {
  const results = await db.query.communityGrowth.findFirst({
    where: and(
      eq(communityGrowth.platform, "reddit"),
      eq(communityGrowth.identifier, `r/${subreddit}`)
    ),
    orderBy: (cg, { desc }) => [desc(cg.recordedAt)],
  });
  return results;
}

/**
 * Main job: Collect community stats for all priority subreddits
 * Runs weekly on Sundays at 3 AM UTC
 */
export const collectCommunityStats = inngest.createFunction(
  {
    id: "collect-community-stats",
    name: "Collect Community Stats",
    retries: 3,
  },
  { cron: "0 3 * * 0" }, // Every Sunday at 3 AM UTC
  async ({ step }) => {
    // Process priority subreddits first
    const priorityResults = await step.run("process-priority-subreddits", async () => {
      const results: Array<{ subreddit: string; success: boolean }> = [];

      for (const subreddit of PRIORITY_SUBREDDITS) {
        try {
          // Rate limit: 1 request per second to be respectful
          await new Promise(resolve => setTimeout(resolve, 1000));

          const info = await fetchSubredditInfo(subreddit);
          if (!info) {
            results.push({ subreddit, success: false });
            continue;
          }

          // Fetch additional metrics
          await new Promise(resolve => setTimeout(resolve, 500));
          const postsPerDay = await estimatePostsPerDay(subreddit);

          await new Promise(resolve => setTimeout(resolve, 500));
          const engagementRate = await calculateEngagementRate(subreddit);

          await storeStats(subreddit, info.subscribers, postsPerDay, engagementRate);
          results.push({ subreddit, success: true });

          console.log(`[CommunityStats] Processed r/${subreddit}: ${info.subscribers.toLocaleString()} members, ${postsPerDay} posts/day`);
        } catch (error) {
          console.error(`[CommunityStats] Failed to process r/${subreddit}:`, error);
          results.push({ subreddit, success: false });
        }
      }

      return results;
    });

    // Process extended subreddits (lower priority)
    const extendedResults = await step.run("process-extended-subreddits", async () => {
      const results: Array<{ subreddit: string; success: boolean }> = [];

      for (const subreddit of EXTENDED_SUBREDDITS) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Slower rate for extended

          const info = await fetchSubredditInfo(subreddit);
          if (!info) {
            results.push({ subreddit, success: false });
            continue;
          }

          await new Promise(resolve => setTimeout(resolve, 500));
          const postsPerDay = await estimatePostsPerDay(subreddit);

          await new Promise(resolve => setTimeout(resolve, 500));
          const engagementRate = await calculateEngagementRate(subreddit);

          await storeStats(subreddit, info.subscribers, postsPerDay, engagementRate);
          results.push({ subreddit, success: true });
        } catch {
          results.push({ subreddit, success: false });
        }
      }

      return results;
    });

    const prioritySuccessCount = priorityResults.filter(r => r.success).length;
    const extendedSuccessCount = extendedResults.filter(r => r.success).length;

    return {
      message: "Community stats collection complete",
      priority: {
        total: PRIORITY_SUBREDDITS.length,
        success: prioritySuccessCount,
        failed: PRIORITY_SUBREDDITS.length - prioritySuccessCount,
      },
      extended: {
        total: EXTENDED_SUBREDDITS.length,
        success: extendedSuccessCount,
        failed: EXTENDED_SUBREDDITS.length - extendedSuccessCount,
      },
    };
  }
);

/**
 * On-demand job: Fetch stats for a specific subreddit (used when page is requested)
 */
export const fetchSubredditStats = inngest.createFunction(
  {
    id: "fetch-subreddit-stats",
    name: "Fetch Subreddit Stats",
    retries: 2,
  },
  { event: "community/fetch-stats" },
  async ({ event, step }) => {
    const { subreddit } = event.data as { subreddit: string };

    const stats = await step.run("fetch-stats", async () => {
      const info = await fetchSubredditInfo(subreddit);
      if (!info) {
        return null;
      }

      const postsPerDay = await estimatePostsPerDay(subreddit);
      const engagementRate = await calculateEngagementRate(subreddit);

      await storeStats(subreddit, info.subscribers, postsPerDay, engagementRate);

      return {
        subreddit,
        memberCount: info.subscribers,
        postsPerDay,
        engagementRate,
        description: info.description,
      };
    });

    return stats;
  }
);

// Export the list of subreddits for sitemap generation
export const ALL_TRACKED_SUBREDDITS = [...PRIORITY_SUBREDDITS, ...EXTENDED_SUBREDDITS];
