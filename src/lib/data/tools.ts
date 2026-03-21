/**
 * Tool page metadata for programmatic SEO pages
 *
 * Used by:
 * - src/app/(marketing)/tools/[slug]/page.tsx
 * - src/app/(marketing)/tools/page.tsx
 * - src/app/sitemap.ts
 */

export interface ToolData {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  features: string[];
  platforms: string[];
  keywords: string[];
  cta: string;
}

export const TOOLS: ToolData[] = [
  {
    slug: "free-reddit-monitor",
    title: "Free Reddit Monitor",
    description:
      "Monitor Reddit mentions of your brand, competitors, or keywords for free.",
    longDescription:
      "Reddit is where your customers talk honestly about products, share frustrations, and recommend alternatives. Kaulby's free Reddit monitor scans subreddits in real time so you never miss a mention. Get AI-powered sentiment analysis, pain point detection, and instant alerts when someone talks about your brand or competitors on Reddit.",
    features: [
      "Monitor unlimited subreddits for brand mentions and keywords",
      "AI-powered sentiment analysis on every Reddit post and comment",
      "Instant email alerts when your brand is mentioned on Reddit",
      "Detect buying signals and competitor complaints in real time",
      "Free tier with daily refresh — no credit card required",
    ],
    platforms: ["Reddit"],
    keywords: [
      "free reddit monitor",
      "reddit brand monitoring",
      "reddit mention tracker",
      "monitor reddit for keywords",
      "reddit social listening",
      "reddit brand alerts",
    ],
    cta: "Start Monitoring Reddit Free",
  },
  {
    slug: "brand-mention-tracker",
    title: "Free Brand Mention Tracker",
    description:
      "Track when your brand is mentioned across 17 platforms.",
    longDescription:
      "Your brand is being discussed across Reddit, Hacker News, Product Hunt, review sites, and more — but you're only seeing a fraction of it. Kaulby's brand mention tracker monitors 17 platforms simultaneously, uses AI to analyze sentiment, and alerts you the moment someone mentions your brand. Stop guessing what people think and start knowing.",
    features: [
      "Track brand mentions across 17 platforms from one dashboard",
      "AI sentiment analysis categorizes mentions as positive, negative, or neutral",
      "Real-time email and webhook alerts for new mentions",
      "Historical trend analysis to see how brand perception changes over time",
      "Team workspaces so your entire org stays informed",
    ],
    platforms: [
      "Reddit",
      "Hacker News",
      "Product Hunt",
      "Google Reviews",
      "Trustpilot",
      "G2",
      "YouTube",
      "X (Twitter)",
      "Dev.to",
      "Quora",
      "GitHub",
    ],
    keywords: [
      "brand mention tracker",
      "brand monitoring tool",
      "track brand mentions",
      "social listening tool",
      "brand mention alerts",
      "online reputation monitoring",
    ],
    cta: "Track Your Brand Mentions Free",
  },
  {
    slug: "google-reviews-monitor",
    title: "Google Reviews Monitor",
    description:
      "Monitor Google Reviews for your business or competitors.",
    longDescription:
      "Google Reviews directly impact your local SEO ranking and customer trust. Kaulby monitors Google Reviews for your business and your competitors, alerting you to new reviews so you can respond quickly to negative feedback and amplify positive ones. AI analysis detects recurring themes, common complaints, and competitive advantages hidden in review data.",
    features: [
      "Automatic monitoring of new Google Reviews for any business",
      "AI-powered theme detection across hundreds of reviews",
      "Competitor review tracking to find their weaknesses",
      "Instant alerts for negative reviews so you can respond fast",
      "Sentiment trend reports to track review quality over time",
    ],
    platforms: [
      "Google Reviews",
      "Trustpilot",
      "G2",
      "Yelp",
      "App Store",
      "Play Store",
      "Amazon Reviews",
    ],
    keywords: [
      "google reviews monitor",
      "google review alerts",
      "monitor google reviews",
      "google review tracker",
      "review monitoring tool",
      "competitor review monitoring",
    ],
    cta: "Monitor Google Reviews Now",
  },
  {
    slug: "competitor-intelligence",
    title: "Competitor Intelligence Tool",
    description:
      "Track competitor mentions, complaints, and feature gaps.",
    longDescription:
      "Your competitors' unhappy customers are your best leads. Kaulby's competitor intelligence tool monitors what people say about your competitors across Reddit, review sites, forums, and social platforms. AI analysis surfaces complaints, feature requests, and switching signals so you can position your product as the better alternative and win customers actively looking for options.",
    features: [
      "Monitor competitor brand names and product mentions across 17 platforms",
      "AI identifies complaints, feature gaps, and switching intent",
      "Lead scoring highlights high-intent prospects mentioning competitors",
      "Side-by-side sentiment comparison between you and competitors",
      "Weekly digest emails summarizing competitor landscape changes",
    ],
    platforms: [
      "Reddit",
      "Hacker News",
      "Product Hunt",
      "G2",
      "Trustpilot",
      "Google Reviews",
      "YouTube",
      "X (Twitter)",
      "Quora",
    ],
    keywords: [
      "competitor intelligence tool",
      "competitor monitoring",
      "track competitor mentions",
      "competitive analysis tool",
      "competitor complaint tracker",
      "competitive intelligence software",
    ],
    cta: "Track Your Competitors Free",
  },
  {
    slug: "buying-signal-finder",
    title: "Buying Signal Finder",
    description:
      "Find people actively looking for products like yours.",
    longDescription:
      "Every day, potential customers post on Reddit, Hacker News, and forums asking for product recommendations in your category. Kaulby's buying signal finder uses AI to detect high-intent posts like 'looking for a tool that...' or 'anyone know an alternative to...' and alerts you in real time. Respond while they're still deciding and convert conversations into customers.",
    features: [
      "AI detects buying-intent language across community platforms",
      "Real-time alerts when someone asks for a recommendation in your space",
      "Lead scoring ranks signals by purchase likelihood and urgency",
      "Track 'alternative to' and 'looking for' queries mentioning competitors",
      "Direct links to conversations so you can respond immediately",
    ],
    platforms: [
      "Reddit",
      "Hacker News",
      "Product Hunt",
      "Quora",
      "Indie Hackers",
      "X (Twitter)",
      "YouTube",
    ],
    keywords: [
      "buying signal finder",
      "purchase intent detection",
      "find potential customers",
      "social selling tool",
      "lead generation from reddit",
      "buying intent monitoring",
    ],
    cta: "Find Buying Signals Free",
  },
  {
    slug: "customer-pain-point-tracker",
    title: "Customer Pain Point Tracker",
    description:
      "Discover what users are complaining about across communities.",
    longDescription:
      "The best product ideas come from real customer frustrations. Kaulby's pain point tracker monitors Reddit, review sites, and community forums to surface what users are struggling with. AI categorizes complaints by theme, severity, and frequency so you can prioritize the fixes and features that matter most. Build what your customers actually need, not what you think they need.",
    features: [
      "AI categorizes pain points by theme, severity, and frequency",
      "Monitor complaints about your product and your category",
      "Trend detection shows emerging issues before they become widespread",
      "Export pain point data for product planning and roadmap prioritization",
      "Cross-platform aggregation shows which pain points appear everywhere",
    ],
    platforms: [
      "Reddit",
      "Hacker News",
      "G2",
      "Trustpilot",
      "Google Reviews",
      "Product Hunt",
      "App Store",
      "Play Store",
      "Yelp",
      "Amazon Reviews",
    ],
    keywords: [
      "customer pain point tracker",
      "user complaint monitoring",
      "voice of customer tool",
      "pain point analysis",
      "customer feedback tracker",
      "product feedback monitoring",
    ],
    cta: "Track Pain Points Free",
  },
];

export const TOOL_BY_SLUG: Record<string, ToolData> = Object.fromEntries(
  TOOLS.map((tool) => [tool.slug, tool])
);

export const ALL_TOOL_SLUGS: string[] = TOOLS.map((tool) => tool.slug);
