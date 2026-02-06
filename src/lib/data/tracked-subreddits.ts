/**
 * Tracked Subreddits for Programmatic SEO Pages
 *
 * This file is intentionally isolated from the Inngest dependency tree.
 * It contains ONLY static data (string arrays) so it can be safely
 * imported by sitemap.ts, subreddit pages, and other lightweight modules
 * without pulling in Inngest, Apify, database, or AI dependencies.
 *
 * Used by:
 * - src/app/sitemap.ts
 * - src/app/subreddits/page.tsx
 * - src/app/subreddits/[slug]/page.tsx
 * - src/lib/inngest/functions/community-stats.ts (re-imports for job logic)
 */

// Top subreddits for business/startup monitoring (prioritized for SEO)
// These are the most valuable for Kaulby's target audience
export const PRIORITY_SUBREDDITS = [
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
export const EXTENDED_SUBREDDITS = [
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

// Combined list of all tracked subreddits for sitemap generation and SEO pages
export const ALL_TRACKED_SUBREDDITS = [...PRIORITY_SUBREDDITS, ...EXTENDED_SUBREDDITS];
