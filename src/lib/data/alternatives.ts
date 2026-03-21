/**
 * Alternative comparison data for programmatic SEO pages
 *
 * These pages target "[competitor] alternative" search queries,
 * distinct from the /compare/ pages which target "Kaulby vs [competitor]" queries.
 *
 * Used by:
 * - src/app/(marketing)/alternative/[slug]/page.tsx
 * - src/app/(marketing)/alternative/page.tsx
 * - src/app/sitemap.ts
 */

export interface AlternativeComparisonRow {
  feature: string;
  kaulby: string;
  competitor: string;
}

export interface AlternativeData {
  slug: string;
  name: string;
  description: string;
  metaDescription: string;
  website: string;
  pricing: string;
  platformCount: string;
  platformList: string[];
  limitations: string[];
  comparisonRows: AlternativeComparisonRow[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const ALTERNATIVES: AlternativeData[] = [
  {
    slug: "gummysearch",
    name: "GummySearch",
    description:
      "GummySearch is a Reddit-focused community research tool that helps you find audience insights and content ideas from subreddits. While useful for Reddit-only research, it lacks multi-platform monitoring, real-time alerts, and AI-driven analysis.",
    metaDescription:
      "Looking for a GummySearch alternative? Kaulby monitors 17 platforms (not just Reddit), adds AI sentiment analysis, lead scoring, and real-time alerts — starting free.",
    website: "https://gummysearch.com",
    pricing: "$29/mo (Pro)",
    platformCount: "Reddit only",
    platformList: ["Reddit"],
    limitations: [
      "Covers Reddit only — misses Hacker News, Product Hunt, review sites, and 14 other platforms",
      "No real-time alerts or webhook/Slack notifications",
      "Limited AI analysis — no pain point detection or sentiment scoring",
      "No lead scoring to prioritize high-intent prospects",
      "No team collaboration features or role-based access",
      "No review site monitoring (G2, Trustpilot, App Store, etc.)",
    ],
    comparisonRows: [
      {
        feature: "Platforms Monitored",
        kaulby: "17 platforms",
        competitor: "Reddit only",
      },
      {
        feature: "AI Sentiment Analysis",
        kaulby: "Full sentiment + categorization",
        competitor: "Basic keyword grouping",
      },
      {
        feature: "Pain Point Detection",
        kaulby: "AI-powered, automatic",
        competitor: "Manual browsing",
      },
      {
        feature: "Lead Scoring",
        kaulby: "Built-in, per mention",
        competitor: "Not available",
      },
      {
        feature: "Pricing",
        kaulby: "Free tier / $29 Pro / $99 Team",
        competitor: "$29/mo Pro",
      },
      {
        feature: "Refresh Speed",
        kaulby: "2–24 hrs (by plan)",
        competitor: "Manual refresh",
      },
    ],
    faqs: [
      {
        question: "Is Kaulby a good alternative to GummySearch?",
        answer:
          "Yes. If you need Reddit monitoring plus coverage of 16 other platforms like Hacker News, Product Hunt, G2, Trustpilot, and X/Twitter, Kaulby is a strong upgrade. Kaulby also adds AI sentiment analysis, lead scoring, real-time alerts, and team features that GummySearch lacks.",
      },
      {
        question: "Can Kaulby do everything GummySearch does on Reddit?",
        answer:
          "Kaulby monitors Reddit with keyword tracking, sentiment analysis, and categorization. GummySearch offers more granular subreddit audience segmentation, but Kaulby compensates with AI-powered pain point detection and multi-platform coverage.",
      },
      {
        question: "How does pricing compare between Kaulby and GummySearch?",
        answer:
          "Both offer Pro plans at $29/mo, but Kaulby includes a free tier with Reddit monitoring and no credit card required. GummySearch has no free tier. For the same price, Kaulby gives you 17 platforms versus Reddit only.",
      },
    ],
  },
  {
    slug: "mention",
    name: "Mention",
    description:
      "Mention is a social listening platform focused on social media and news monitoring. It covers mainstream social channels well, but has limited depth on community platforms like Reddit, Hacker News, and review sites where your customers are actually talking.",
    metaDescription:
      "Looking for a Mention alternative? Kaulby monitors 17 community platforms with AI analysis and lead scoring — better community coverage at a lower price.",
    website: "https://mention.com",
    pricing: "From $41/mo",
    platformCount: "Social media + news",
    platformList: [
      "Twitter/X",
      "Facebook",
      "Instagram",
      "News sites",
      "Blogs",
      "Forums (limited)",
    ],
    limitations: [
      "Weak Reddit monitoring — no deep subreddit tracking or comment analysis",
      "No Hacker News, Product Hunt, or developer community coverage",
      "No review site monitoring (G2, Trustpilot, App Store, Play Store)",
      "No AI-powered pain point detection or lead scoring",
      "Higher starting price ($41/mo) with no free tier",
      "Community platform coverage is an afterthought, not the core product",
    ],
    comparisonRows: [
      {
        feature: "Platforms Monitored",
        kaulby: "17 community + review platforms",
        competitor: "Social media + news/blogs",
      },
      {
        feature: "AI Sentiment Analysis",
        kaulby: "Full sentiment + categorization",
        competitor: "Basic sentiment scoring",
      },
      {
        feature: "Pain Point Detection",
        kaulby: "AI-powered, automatic",
        competitor: "Not available",
      },
      {
        feature: "Lead Scoring",
        kaulby: "Built-in, per mention",
        competitor: "Not available",
      },
      {
        feature: "Pricing",
        kaulby: "Free tier / $29 Pro / $99 Team",
        competitor: "From $41/mo (no free tier)",
      },
      {
        feature: "Refresh Speed",
        kaulby: "2–24 hrs (by plan)",
        competitor: "Near real-time on social",
      },
    ],
    faqs: [
      {
        question: "Is Kaulby a good alternative to Mention?",
        answer:
          "Yes, especially if your audience is on Reddit, Hacker News, developer communities, or review sites. Mention excels at mainstream social media and news monitoring, but Kaulby provides deeper community platform coverage with AI analysis at a lower price.",
      },
      {
        question: "Does Mention monitor Reddit well?",
        answer:
          "Mention offers limited Reddit coverage. It can pick up some mentions, but lacks the deep subreddit tracking, comment-level analysis, and community-specific AI insights that Kaulby provides.",
      },
      {
        question: "Which is cheaper, Kaulby or Mention?",
        answer:
          "Kaulby is more affordable. It offers a free tier with Reddit monitoring and a Pro plan at $29/mo. Mention starts at $41/mo with no free option. Kaulby also includes AI analysis and lead scoring at every tier.",
      },
    ],
  },
  {
    slug: "brand24",
    name: "Brand24",
    description:
      "Brand24 is a social listening platform with broad online monitoring capabilities. It covers social media, news, and blogs, but lacks depth on community platforms and developer ecosystems that matter to SaaS and startup teams.",
    metaDescription:
      "Looking for a Brand24 alternative? Kaulby offers deeper community monitoring across 17 platforms with AI analysis and lead scoring — starting at $0/mo.",
    website: "https://brand24.com",
    pricing: "From $79/mo",
    platformCount: "Social + news + blogs",
    platformList: [
      "Twitter/X",
      "Facebook",
      "Instagram",
      "TikTok",
      "News sites",
      "Blogs",
      "Forums (limited)",
    ],
    limitations: [
      "Poor Reddit monitoring — no deep subreddit tracking or comment-level analysis",
      "No Hacker News, Product Hunt, GitHub, or Dev.to coverage",
      "Limited review site coverage (no G2, Trustpilot, App Store, Play Store)",
      "No AI pain point detection or lead scoring",
      "Expensive starting price ($79/mo) with no free tier",
      "Built for social media marketers, not community or product teams",
    ],
    comparisonRows: [
      {
        feature: "Platforms Monitored",
        kaulby: "17 community + review platforms",
        competitor: "Social media + news/blogs",
      },
      {
        feature: "AI Sentiment Analysis",
        kaulby: "Full sentiment + categorization",
        competitor: "Sentiment scoring",
      },
      {
        feature: "Pain Point Detection",
        kaulby: "AI-powered, automatic",
        competitor: "Not available",
      },
      {
        feature: "Lead Scoring",
        kaulby: "Built-in, per mention",
        competitor: "Not available",
      },
      {
        feature: "Pricing",
        kaulby: "Free tier / $29 Pro / $99 Team",
        competitor: "From $79/mo (no free tier)",
      },
      {
        feature: "Refresh Speed",
        kaulby: "2–24 hrs (by plan)",
        competitor: "Near real-time on social",
      },
    ],
    faqs: [
      {
        question: "Is Kaulby better than Brand24 for community monitoring?",
        answer:
          "Yes. Kaulby is purpose-built for community monitoring across Reddit, Hacker News, Product Hunt, developer platforms, and review sites. Brand24 is better for mainstream social media and news. If your audience lives in communities rather than on Instagram, Kaulby is the better choice.",
      },
      {
        question: "How much cheaper is Kaulby compared to Brand24?",
        answer:
          "Kaulby offers a free tier and Pro plans starting at $29/mo. Brand24 starts at $79/mo with no free option. That makes Kaulby roughly 63% cheaper for comparable monitoring, plus you get AI lead scoring and pain point detection included.",
      },
      {
        question: "Does Brand24 monitor Reddit?",
        answer:
          "Brand24 has limited Reddit coverage. It can detect some mentions, but it lacks deep subreddit monitoring, comment-level tracking, and the AI-powered community insights that Kaulby provides.",
      },
    ],
  },
  {
    slug: "syften",
    name: "Syften",
    description:
      "Syften is a community monitoring tool that tracks mentions across Reddit, Hacker News, and other forums. It is affordable and focused, but lacks AI-powered analysis, lead scoring, and the breadth of platform coverage that modern teams need.",
    metaDescription:
      "Looking for a Syften alternative? Kaulby monitors 17 platforms with AI sentiment analysis, lead scoring, and team features — with a free tier to start.",
    website: "https://syften.com",
    pricing: "$17/mo",
    platformCount: "Reddit + a few forums",
    platformList: [
      "Reddit",
      "Hacker News",
      "Lobsters",
      "Dev.to",
      "Indie Hackers",
    ],
    limitations: [
      "No AI-powered sentiment analysis or categorization",
      "No pain point detection or lead scoring",
      "Limited platform coverage — no review sites, no YouTube, no X/Twitter",
      "No team collaboration features or workspace management",
      "Basic email alerts only — no Slack or webhook integrations",
      "No dashboard or analytics beyond keyword matches",
    ],
    comparisonRows: [
      {
        feature: "Platforms Monitored",
        kaulby: "17 platforms",
        competitor: "~5 forums",
      },
      {
        feature: "AI Sentiment Analysis",
        kaulby: "Full sentiment + categorization",
        competitor: "Not available",
      },
      {
        feature: "Pain Point Detection",
        kaulby: "AI-powered, automatic",
        competitor: "Not available",
      },
      {
        feature: "Lead Scoring",
        kaulby: "Built-in, per mention",
        competitor: "Not available",
      },
      {
        feature: "Pricing",
        kaulby: "Free tier / $29 Pro / $99 Team",
        competitor: "$17/mo (single tier)",
      },
      {
        feature: "Refresh Speed",
        kaulby: "2–24 hrs (by plan)",
        competitor: "Near real-time",
      },
    ],
    faqs: [
      {
        question: "Is Kaulby a good alternative to Syften?",
        answer:
          "Yes. Kaulby covers everything Syften does (Reddit, Hacker News, forums) plus 12 additional platforms including review sites, YouTube, X/Twitter, and more. Kaulby also adds AI analysis, lead scoring, and team features that Syften lacks.",
      },
      {
        question: "Syften is cheaper — why choose Kaulby?",
        answer:
          "Syften starts at $17/mo, but Kaulby offers a free tier with Reddit monitoring. For $29/mo (Pro), Kaulby gives you 9 platforms with AI sentiment analysis, pain point detection, and lead scoring — features Syften does not offer at any price.",
      },
      {
        question: "Does Syften have AI features?",
        answer:
          "No. Syften is a keyword matching tool — it finds mentions but does not analyze them. Kaulby uses AI to classify sentiment, detect pain points, categorize mentions, and score leads automatically.",
      },
    ],
  },
  {
    slug: "f5bot",
    name: "F5Bot",
    description:
      "F5Bot is a free, open-source tool that sends email alerts when your keywords appear on Reddit, Hacker News, or Lobsters. It is a great starting point, but has no dashboard, no AI analysis, and no support for review sites or broader community platforms.",
    metaDescription:
      "Looking for a F5Bot alternative? Kaulby offers 17-platform monitoring with AI analysis, lead scoring, dashboards, and team features — with a free tier.",
    website: "https://f5bot.com",
    pricing: "Free",
    platformCount: "Reddit + HN + Lobsters",
    platformList: ["Reddit", "Hacker News", "Lobsters"],
    limitations: [
      "Only monitors 3 platforms — no review sites, YouTube, X/Twitter, or others",
      "No dashboard or analytics — just raw email notifications",
      "No AI analysis, sentiment scoring, or categorization",
      "No lead scoring or pain point detection",
      "No team features, API, or integrations (Slack, webhooks)",
      "Limited keyword configuration — no advanced filters or Boolean logic",
    ],
    comparisonRows: [
      {
        feature: "Platforms Monitored",
        kaulby: "17 platforms",
        competitor: "3 platforms",
      },
      {
        feature: "AI Sentiment Analysis",
        kaulby: "Full sentiment + categorization",
        competitor: "Not available",
      },
      {
        feature: "Pain Point Detection",
        kaulby: "AI-powered, automatic",
        competitor: "Not available",
      },
      {
        feature: "Lead Scoring",
        kaulby: "Built-in, per mention",
        competitor: "Not available",
      },
      {
        feature: "Pricing",
        kaulby: "Free tier / $29 Pro / $99 Team",
        competitor: "Free (limited)",
      },
      {
        feature: "Dashboard & Analytics",
        kaulby: "Full dashboard + charts",
        competitor: "Email alerts only",
      },
    ],
    faqs: [
      {
        question: "Is Kaulby better than F5Bot?",
        answer:
          "F5Bot is a great free tool for basic keyword alerts on Reddit and Hacker News. Kaulby is a full monitoring platform with 17 platforms, AI analysis, lead scoring, dashboards, and team features. If you have outgrown F5Bot, Kaulby is the natural upgrade — and it also has a free tier.",
      },
      {
        question: "Is Kaulby free like F5Bot?",
        answer:
          "Kaulby has a free tier that includes Reddit monitoring with 1 monitor and 3 keywords — similar to F5Bot but with a dashboard, AI analysis, and more features. Paid plans start at $29/mo for 9 platforms.",
      },
      {
        question: "Why switch from F5Bot to Kaulby?",
        answer:
          "F5Bot gives you keyword alerts but nothing else. Kaulby gives you a full monitoring dashboard, AI-powered sentiment analysis, pain point detection, lead scoring, team workspaces, and coverage of 17 platforms including review sites and YouTube.",
      },
    ],
  },
];

/**
 * Lookup map by slug for efficient access
 */
export const ALTERNATIVE_BY_SLUG: Record<string, AlternativeData> =
  Object.fromEntries(ALTERNATIVES.map((a) => [a.slug, a]));

/**
 * All alternative slugs for generateStaticParams() and sitemap
 */
export const ALL_ALTERNATIVE_SLUGS = ALTERNATIVES.map((a) => a.slug);
