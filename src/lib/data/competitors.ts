/**
 * Competitor comparison data for programmatic SEO pages
 *
 * Used by:
 * - src/app/(marketing)/compare/[slug]/page.tsx
 * - src/app/sitemap.ts
 */

export interface CompetitorFeature {
  name: string;
  kaulby: string | boolean;
  competitor: string | boolean;
}

export interface CompetitorData {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  metaDescription: string;
  website: string;
  category: string;
  pricing: string;
  kaulbyAdvantages: string[];
  competitorAdvantages: string[];
  features: CompetitorFeature[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const COMPETITORS: CompetitorData[] = [
  {
    slug: "brand24",
    name: "Brand24",
    tagline: "Enterprise social listening platform",
    description:
      "Brand24 is a social listening platform focused on social media monitoring. Compare it to Kaulby's community-first approach that covers Reddit, forums, and review sites.",
    metaDescription:
      "Kaulby vs Brand24 comparison. See how Kaulby's community monitoring with AI sentiment analysis compares to Brand24's social listening. Feature and pricing comparison.",
    website: "https://brand24.com",
    category: "Social Listening",
    pricing: "From $79/mo",
    kaulbyAdvantages: [
      "Monitors Reddit, Hacker News, and developer communities that Brand24 covers poorly",
      "AI-powered pain point detection and lead scoring",
      "Purpose-built for startups and SaaS at a fraction of the cost",
      "Free tier available for small teams to get started",
      "Covers 7 review platforms (G2, Trustpilot, app stores, etc.)",
    ],
    competitorAdvantages: [
      "Broader social media coverage (Facebook, Instagram, TikTok)",
      "Longer track record and larger customer base",
      "More advanced reporting and analytics dashboards",
      "Influencer identification features",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: "Limited" },
      { name: "Hacker News", kaulby: true, competitor: false },
      { name: "Product Hunt", kaulby: true, competitor: false },
      { name: "GitHub", kaulby: true, competitor: false },
      { name: "G2 Reviews", kaulby: true, competitor: false },
      { name: "App Store Reviews", kaulby: true, competitor: false },
      { name: "X/Twitter", kaulby: true, competitor: true },
      { name: "Facebook", kaulby: false, competitor: true },
      { name: "Instagram", kaulby: false, competitor: true },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: true },
      { name: "Pain Point Detection", kaulby: true, competitor: false },
      { name: "Lead Scoring", kaulby: true, competitor: false },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$79/mo" },
    ],
    faqs: [
      {
        question: "Is Kaulby a good alternative to Brand24?",
        answer:
          "Yes, especially if you need strong Reddit, Hacker News, and developer community monitoring. Kaulby is purpose-built for startup and SaaS community monitoring at a lower price point. Brand24 is better if you need Facebook, Instagram, or TikTok coverage.",
      },
      {
        question: "How does pricing compare?",
        answer:
          "Kaulby starts at $29/mo (Pro) with a free tier available. Brand24 starts at $79/mo with no free tier. Kaulby offers better value for community and review monitoring.",
      },
    ],
  },
  {
    slug: "mention",
    name: "Mention",
    tagline: "Media monitoring and social listening",
    description:
      "Mention focuses on social media and news monitoring. Compare it to Kaulby's community-first monitoring that covers Reddit, developer platforms, and review sites.",
    metaDescription:
      "Kaulby vs Mention comparison. Compare community monitoring features, platform coverage, AI analysis, and pricing. Find the right monitoring tool for your business.",
    website: "https://mention.com",
    category: "Media Monitoring",
    pricing: "From $41/mo",
    kaulbyAdvantages: [
      "Deep Reddit and community platform monitoring",
      "AI-powered pain point detection for lead generation",
      "Covers developer platforms (GitHub, HN, Dev.to)",
      "Review site monitoring (G2, Trustpilot, app stores)",
      "More affordable with a free tier",
    ],
    competitorAdvantages: [
      "Broader news and media monitoring",
      "Facebook and Instagram support",
      "Larger historical data archive",
      "More established enterprise features",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: "Limited" },
      { name: "Hacker News", kaulby: true, competitor: false },
      { name: "Product Hunt", kaulby: true, competitor: false },
      { name: "GitHub", kaulby: true, competitor: false },
      { name: "News Monitoring", kaulby: false, competitor: true },
      { name: "Facebook", kaulby: false, competitor: true },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: true },
      { name: "Pain Point Detection", kaulby: true, competitor: false },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$41/mo" },
    ],
    faqs: [
      {
        question: "Should I choose Kaulby or Mention?",
        answer:
          "Choose Kaulby if your audience lives on Reddit, Hacker News, and developer communities. Choose Mention if you need news/media monitoring and broad social media coverage.",
      },
    ],
  },
  {
    slug: "gummysearch",
    name: "GummySearch",
    tagline: "Reddit audience research tool",
    description:
      "GummySearch is a Reddit-focused audience research tool. Compare it to Kaulby's multi-platform community monitoring with AI-powered analysis and real-time alerts.",
    metaDescription:
      "Kaulby vs GummySearch comparison. See how Kaulby's 17-platform monitoring compares to GummySearch's Reddit-only tool. Features, pricing, and use cases compared.",
    website: "https://gummysearch.com",
    category: "Reddit Research",
    pricing: "From $19/mo",
    kaulbyAdvantages: [
      "Monitors 17 platforms vs Reddit only",
      "Real-time alerts via email, Slack, and webhooks",
      "AI-powered sentiment analysis and categorization",
      "Review site monitoring (Trustpilot, G2, app stores)",
      "Team collaboration with role-based access",
    ],
    competitorAdvantages: [
      "Lower starting price for Reddit-only use",
      "More granular Reddit audience segmentation",
      "Built-in Reddit posting suggestions",
      "Reddit-specific analytics and insights",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: true },
      { name: "Hacker News", kaulby: true, competitor: false },
      { name: "Product Hunt", kaulby: true, competitor: false },
      { name: "Review Sites", kaulby: "7 platforms", competitor: false },
      { name: "X/Twitter", kaulby: true, competitor: false },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: "Basic" },
      { name: "Real-time Alerts", kaulby: true, competitor: false },
      { name: "Slack Integration", kaulby: true, competitor: false },
      { name: "Webhook Alerts", kaulby: true, competitor: false },
      { name: "Team Seats", kaulby: true, competitor: false },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$19/mo" },
    ],
    faqs: [
      {
        question: "Is Kaulby better than GummySearch?",
        answer:
          "If you only need Reddit monitoring, GummySearch is a solid choice at a lower price. If you need multi-platform monitoring, alerts, AI analysis, and team features, Kaulby is the better investment.",
      },
      {
        question: "Can Kaulby replace GummySearch?",
        answer:
          "Yes. Kaulby covers all Reddit monitoring capabilities and adds 16 additional platforms, real-time alerts, and deeper AI analysis.",
      },
    ],
  },
  {
    slug: "brandwatch",
    name: "Brandwatch",
    tagline: "Enterprise consumer intelligence platform",
    description:
      "Brandwatch is an enterprise social intelligence platform. Compare it to Kaulby's affordable, community-focused monitoring built for startups and growing businesses.",
    metaDescription:
      "Kaulby vs Brandwatch comparison. Enterprise-level community monitoring without enterprise pricing. Compare features, platforms, and pricing.",
    website: "https://brandwatch.com",
    category: "Consumer Intelligence",
    pricing: "Custom (typically $1000+/mo)",
    kaulbyAdvantages: [
      "Dramatically more affordable (starting at $29/mo vs $1000+/mo)",
      "Free tier available - no sales call required to start",
      "Better Reddit, HN, and developer community coverage",
      "Faster setup - minutes instead of weeks",
      "Purpose-built for startups and SMBs",
    ],
    competitorAdvantages: [
      "Much larger data archive and historical data",
      "Advanced analytics, dashboards, and custom reporting",
      "Broader social media platform coverage",
      "Enterprise features (SSO, SLA, dedicated support)",
      "Image and video analysis capabilities",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: true },
      { name: "Hacker News", kaulby: true, competitor: false },
      { name: "Developer Platforms", kaulby: "4 platforms", competitor: false },
      { name: "Review Sites", kaulby: "7 platforms", competitor: "Limited" },
      { name: "Facebook & Instagram", kaulby: false, competitor: true },
      { name: "Image Analysis", kaulby: false, competitor: true },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: true },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Setup Time", kaulby: "Minutes", competitor: "Weeks" },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$1000+/mo" },
    ],
    faqs: [
      {
        question: "Is Kaulby a good Brandwatch alternative for startups?",
        answer:
          "Yes. Kaulby provides the community monitoring capabilities that matter most to startups at a fraction of Brandwatch's cost. Brandwatch is designed for large enterprises with deep pockets.",
      },
    ],
  },
  {
    slug: "hootsuite",
    name: "Hootsuite",
    tagline: "Social media management platform",
    description:
      "Hootsuite is primarily a social media management tool with listening features. Compare it to Kaulby's dedicated community monitoring and analysis platform.",
    metaDescription:
      "Kaulby vs Hootsuite comparison. Dedicated community monitoring vs social media management. Compare monitoring features, platform coverage, and pricing.",
    website: "https://hootsuite.com",
    category: "Social Media Management",
    pricing: "From $99/mo",
    kaulbyAdvantages: [
      "Dedicated monitoring tool vs general social media management",
      "Deep Reddit, HN, and community platform coverage",
      "AI-powered pain point detection and categorization",
      "Review site monitoring across 7 platforms",
      "More affordable starting price with free tier",
    ],
    competitorAdvantages: [
      "Social media scheduling and publishing",
      "Team inbox for social media engagement",
      "Broader social platform management (FB, IG, LinkedIn)",
      "All-in-one social media tool",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: "Basic" },
      { name: "Hacker News", kaulby: true, competitor: false },
      { name: "Product Hunt", kaulby: true, competitor: false },
      { name: "Social Publishing", kaulby: false, competitor: true },
      { name: "Social Inbox", kaulby: false, competitor: true },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: "Basic" },
      { name: "Pain Point Detection", kaulby: true, competitor: false },
      { name: "Review Monitoring", kaulby: "7 platforms", competitor: false },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$99/mo" },
    ],
    faqs: [
      {
        question: "Should I use Kaulby or Hootsuite?",
        answer:
          "They serve different purposes. Use Hootsuite for social media management (scheduling, publishing, team inbox). Use Kaulby for community monitoring and intelligence. Many teams use both.",
      },
    ],
  },
  {
    slug: "sprout-social",
    name: "Sprout Social",
    tagline: "Social media management and analytics",
    description:
      "Sprout Social is a premium social media management platform. Compare it to Kaulby's focused community monitoring tool built for startups.",
    metaDescription:
      "Kaulby vs Sprout Social comparison. Community monitoring for startups vs enterprise social media management. Compare features and pricing.",
    website: "https://sproutsocial.com",
    category: "Social Media Management",
    pricing: "From $249/mo",
    kaulbyAdvantages: [
      "10x more affordable ($29/mo vs $249/mo)",
      "Deep Reddit and community coverage",
      "Developer platform monitoring (GitHub, HN, Dev.to)",
      "Free tier available - no commitment needed",
      "AI pain point detection for lead generation",
    ],
    competitorAdvantages: [
      "Comprehensive social media management suite",
      "Advanced reporting and analytics",
      "Team workflow and approval features",
      "CRM integration",
      "Social commerce features",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: "Limited" },
      { name: "Community Platforms", kaulby: "17 platforms", competitor: "Limited" },
      { name: "Social Publishing", kaulby: false, competitor: true },
      { name: "CRM Integration", kaulby: false, competitor: true },
      { name: "AI Analysis", kaulby: true, competitor: true },
      { name: "Pain Point Detection", kaulby: true, competitor: false },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$249/mo" },
    ],
    faqs: [
      {
        question: "Is Kaulby a replacement for Sprout Social?",
        answer:
          "Not exactly. Sprout Social is a full social media management suite. Kaulby is a focused community monitoring tool. If you only need monitoring (not publishing/management), Kaulby is a much more affordable choice.",
      },
    ],
  },
  {
    slug: "talkwalker",
    name: "Talkwalker",
    tagline: "Consumer intelligence platform",
    description:
      "Talkwalker is an enterprise consumer intelligence platform. Compare it to Kaulby's affordable community monitoring built for startups and growing businesses.",
    metaDescription:
      "Kaulby vs Talkwalker comparison. Startup-friendly community monitoring vs enterprise consumer intelligence. Compare features, platforms, and pricing.",
    website: "https://talkwalker.com",
    category: "Consumer Intelligence",
    pricing: "Custom (typically $9000+/year)",
    kaulbyAdvantages: [
      "Massively more affordable - $29/mo vs $9000+/year",
      "Self-serve signup with free tier",
      "Better Reddit and developer community coverage",
      "Faster time-to-value (minutes vs weeks)",
      "Built for the platforms startups care about",
    ],
    competitorAdvantages: [
      "Massive data coverage across news, blogs, and social",
      "Advanced AI analytics and image recognition",
      "Enterprise-grade reporting and dashboards",
      "Dedicated account management",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: true },
      { name: "Developer Platforms", kaulby: "4 platforms", competitor: false },
      { name: "Review Sites", kaulby: "7 platforms", competitor: "Limited" },
      { name: "News Monitoring", kaulby: false, competitor: true },
      { name: "Image Recognition", kaulby: false, competitor: true },
      { name: "AI Analysis", kaulby: true, competitor: true },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Self-Serve Signup", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$9000+/year" },
    ],
    faqs: [
      {
        question: "Is Kaulby a good Talkwalker alternative for small teams?",
        answer:
          "Absolutely. Talkwalker is designed for large enterprises with dedicated budgets. Kaulby provides the community monitoring capabilities most startups and small teams need at a fraction of the cost.",
      },
    ],
  },
  {
    slug: "buzzsumo",
    name: "BuzzSumo",
    tagline: "Content research and monitoring platform",
    description:
      "BuzzSumo focuses on content research and social sharing analytics. Compare it to Kaulby's community discussion monitoring and sentiment analysis.",
    metaDescription:
      "Kaulby vs BuzzSumo comparison. Community discussion monitoring vs content research. Compare features for brand monitoring and market intelligence.",
    website: "https://buzzsumo.com",
    category: "Content Research",
    pricing: "From $199/mo",
    kaulbyAdvantages: [
      "Monitors discussions and conversations, not just content shares",
      "Deep Reddit and community coverage",
      "AI sentiment analysis on every mention",
      "Review site monitoring across 7 platforms",
      "7x more affordable with free tier",
    ],
    competitorAdvantages: [
      "Content performance analytics",
      "Influencer identification and outreach",
      "Content idea generation from trending topics",
      "Backlink and share count tracking",
    ],
    features: [
      { name: "Reddit Discussion Monitoring", kaulby: true, competitor: "Limited" },
      { name: "Content Share Tracking", kaulby: false, competitor: true },
      { name: "Influencer Identification", kaulby: false, competitor: true },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: false },
      { name: "Community Discussion Tracking", kaulby: true, competitor: false },
      { name: "Review Site Monitoring", kaulby: "7 platforms", competitor: false },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$199/mo" },
    ],
    faqs: [
      {
        question: "Kaulby or BuzzSumo: which should I choose?",
        answer:
          "Choose BuzzSumo for content research and influencer marketing. Choose Kaulby for monitoring community discussions, customer feedback, and brand mentions across forums and review sites.",
      },
    ],
  },
  {
    slug: "awario",
    name: "Awario",
    tagline: "Social listening and analytics tool",
    description:
      "Awario is a social listening tool with web monitoring. Compare it to Kaulby's specialized community and review platform monitoring.",
    metaDescription:
      "Kaulby vs Awario comparison. Community-first monitoring vs general social listening. Compare platform coverage, AI features, and pricing.",
    website: "https://awario.com",
    category: "Social Listening",
    pricing: "From $49/mo",
    kaulbyAdvantages: [
      "Better Reddit and community platform depth",
      "Developer platform coverage (GitHub, HN, Dev.to)",
      "7 review platforms included",
      "AI pain point detection for lead gen",
      "More affordable with free tier",
    ],
    competitorAdvantages: [
      "Web-wide monitoring beyond specific platforms",
      "Boolean search across all sources",
      "Lead generation features built in",
      "Sentiment analysis across all sources",
    ],
    features: [
      { name: "Reddit Monitoring", kaulby: true, competitor: true },
      { name: "Web Monitoring", kaulby: false, competitor: true },
      { name: "Developer Platforms", kaulby: "4 platforms", competitor: false },
      { name: "Review Sites", kaulby: "7 platforms", competitor: false },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: true },
      { name: "Pain Point Detection", kaulby: true, competitor: false },
      { name: "Boolean Search", kaulby: true, competitor: true },
      { name: "Free Tier", kaulby: true, competitor: false },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$49/mo" },
    ],
    faqs: [
      {
        question: "How does Kaulby compare to Awario?",
        answer:
          "Kaulby excels at community platform monitoring (Reddit, HN, developer sites, review platforms) with AI analysis. Awario offers broader web monitoring. Choose based on whether your audience is on specific community platforms (Kaulby) or scattered across the web (Awario).",
      },
    ],
  },
  {
    slug: "social-searcher",
    name: "Social Searcher",
    tagline: "Free social media search engine",
    description:
      "Social Searcher is a free social media search tool. Compare it to Kaulby's comprehensive monitoring platform with AI analysis, alerts, and team features.",
    metaDescription:
      "Kaulby vs Social Searcher comparison. Comprehensive AI-powered monitoring vs basic social search. Compare features, platforms, and capabilities.",
    website: "https://social-searcher.com",
    category: "Social Search",
    pricing: "Free / From $3.49/mo",
    kaulbyAdvantages: [
      "Automated monitoring with alerts (not just search)",
      "AI-powered sentiment analysis and categorization",
      "17 platform coverage including review sites",
      "Team collaboration features",
      "Professional dashboard with analytics",
    ],
    competitorAdvantages: [
      "Very low cost for basic searches",
      "No account required for basic use",
      "Simple, no-frills interface",
      "Real-time social media search",
    ],
    features: [
      { name: "Automated Monitoring", kaulby: true, competitor: "Limited" },
      { name: "Alert Notifications", kaulby: true, competitor: "Basic" },
      { name: "Reddit Monitoring", kaulby: true, competitor: "Basic" },
      { name: "Review Sites", kaulby: "7 platforms", competitor: false },
      { name: "Developer Platforms", kaulby: "4 platforms", competitor: false },
      { name: "AI Sentiment Analysis", kaulby: true, competitor: "Basic" },
      { name: "Pain Point Detection", kaulby: true, competitor: false },
      { name: "Team Features", kaulby: true, competitor: false },
      { name: "Free Tier", kaulby: true, competitor: true },
      { name: "Starting Price", kaulby: "$29/mo", competitor: "$3.49/mo" },
    ],
    faqs: [
      {
        question: "Why pay for Kaulby when Social Searcher is free?",
        answer:
          "Social Searcher is a search tool - you manually search and browse results. Kaulby is an automated monitoring platform that continuously scans 17 platforms, analyzes sentiment with AI, and sends you alerts. If you need ongoing monitoring rather than one-off searches, Kaulby provides significantly more value.",
      },
    ],
  },
];

/**
 * Lookup map by slug for efficient access
 */
export const COMPETITOR_BY_SLUG: Record<string, CompetitorData> = Object.fromEntries(
  COMPETITORS.map((c) => [c.slug, c])
);

/**
 * All competitor slugs for generateStaticParams() and sitemap
 */
export const ALL_COMPETITOR_SLUGS = COMPETITORS.map((c) => c.slug);
