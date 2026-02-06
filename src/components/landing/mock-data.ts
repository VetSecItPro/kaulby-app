export type MockResult = {
  id: string;
  platform: string;
  title: string;
  author: string;
  time: string;
  sentiment: "positive" | "negative" | "neutral";
  category: string;
  leadScore: number;
  aiSummary: string;
  monitorName: string;
  isNew: boolean;
};

export type MockMonitor = {
  id: string;
  name: string;
  keywords: string[];
  platforms: string[];
  newCount: number;
  status: "active" | "paused";
};

export type MockInsight = {
  topic: string;
  mentions: number;
  trend: "up" | "flat";
  platforms: string[];
  sentimentPositive: number;
  sentimentNegative: number;
  sentimentNeutral: number;
  keywords: string[];
};

export type MockAnalyticDay = {
  day: string;
  value: number;
};

export type MockPlatformBreakdown = {
  platform: string;
  count: number;
  color: string;
};

export const MOCK_RESULTS: MockResult[] = [
  {
    id: "1",
    platform: "reddit",
    title: "Just switched from Asana to Trellis — the AI task prioritization is actually useful",
    author: "u/productivitynerd",
    time: "2h ago",
    sentiment: "positive",
    category: "solution_request",
    leadScore: 87,
    aiSummary:
      "User describes migrating their 15-person team from Asana to Trellis, praising the AI prioritization engine and noting 30% reduction in missed deadlines.",
    monitorName: "Trellis Brand Mentions",
    isNew: true,
  },
  {
    id: "2",
    platform: "hackernews",
    title: "Ask HN: Best project management tools for remote engineering teams?",
    author: "devlead_sarah",
    time: "4h ago",
    sentiment: "neutral",
    category: "advice_request",
    leadScore: 72,
    aiSummary:
      "Thread asking for PM tool recommendations. Multiple comments mention Trellis alongside Linear and Notion. Key interest in API integrations.",
    monitorName: "Competitor Watch",
    isNew: true,
  },
  {
    id: "3",
    platform: "trustpilot",
    title: "Great tool but the mobile app needs work",
    author: "James K.",
    time: "6h ago",
    sentiment: "negative",
    category: "pain_point",
    leadScore: 45,
    aiSummary:
      "4-star review praising desktop experience but criticizing mobile app performance. Mentions slow load times and missing offline mode.",
    monitorName: "Trellis Brand Mentions",
    isNew: false,
  },
  {
    id: "4",
    platform: "producthunt",
    title: "Trellis 3.0 — AI-powered project management for modern teams",
    author: "trellis_team",
    time: "1d ago",
    sentiment: "positive",
    category: "hot_discussion",
    leadScore: 91,
    aiSummary:
      "Product Hunt launch with 340+ upvotes. Comments highlight AI features and clean UI. Several enterprise prospects asking about SSO and SOC 2.",
    monitorName: "Trellis Brand Mentions",
    isNew: false,
  },
  {
    id: "5",
    platform: "g2",
    title: "Enterprise pricing is steep but the ROI is there",
    author: "Verified User in SaaS",
    time: "2d ago",
    sentiment: "positive",
    category: "money_talk",
    leadScore: 63,
    aiSummary:
      "G2 review from enterprise customer comparing Trellis pricing to Monday.com. Notes that automation features justify the premium.",
    monitorName: "Feature Requests",
    isNew: false,
  },
  {
    id: "6",
    platform: "x",
    title: "Been using @trellis_app for 2 months now and the AI task prioritization has genuinely changed how our team works",
    author: "@sarahbuilds",
    time: "3h ago",
    sentiment: "positive",
    category: "solution_request",
    leadScore: 78,
    aiSummary:
      "Organic endorsement from a startup founder with 12K followers. Mentions specific AI features and team productivity gains. High engagement with 45 likes and 12 retweets.",
    monitorName: "Trellis Brand Mentions",
    isNew: true,
  },
];

export const MOCK_MONITORS: MockMonitor[] = [
  {
    id: "m1",
    name: "Trellis Brand Mentions",
    keywords: ["trellis", "trellis app", "trellis pm"],
    platforms: ["reddit", "hackernews", "producthunt", "trustpilot"],
    newCount: 12,
    status: "active",
  },
  {
    id: "m2",
    name: "Competitor Watch",
    keywords: ["asana alternative", "monday.com vs", "project management tool"],
    platforms: ["reddit", "hackernews", "g2", "quora"],
    newCount: 8,
    status: "active",
  },
  {
    id: "m3",
    name: "Feature Requests",
    keywords: ["trellis feature", "trellis roadmap", "trellis integration"],
    platforms: ["reddit", "producthunt", "github"],
    newCount: 3,
    status: "active",
  },
];

export const MOCK_INSIGHTS: MockInsight[] = [
  {
    topic: "Mobile App Experience",
    mentions: 14,
    trend: "up",
    platforms: ["reddit", "trustpilot", "g2"],
    sentimentPositive: 4,
    sentimentNegative: 8,
    sentimentNeutral: 2,
    keywords: ["mobile", "app", "offline", "slow"],
  },
  {
    topic: "Trellis vs Asana",
    mentions: 11,
    trend: "up",
    platforms: ["reddit", "hackernews", "quora"],
    sentimentPositive: 7,
    sentimentNegative: 2,
    sentimentNeutral: 2,
    keywords: ["asana", "migration", "comparison", "switch"],
  },
  {
    topic: "Enterprise Pricing",
    mentions: 8,
    trend: "flat",
    platforms: ["g2", "reddit", "producthunt"],
    sentimentPositive: 3,
    sentimentNegative: 3,
    sentimentNeutral: 2,
    keywords: ["pricing", "enterprise", "ROI", "cost"],
  },
  {
    topic: "AI Task Prioritization",
    mentions: 9,
    trend: "up",
    platforms: ["hackernews", "producthunt", "reddit"],
    sentimentPositive: 7,
    sentimentNegative: 1,
    sentimentNeutral: 1,
    keywords: ["AI", "prioritization", "automation", "smart"],
  },
];

export const MOCK_ANALYTICS_DAILY: MockAnalyticDay[] = [
  { day: "Mon", value: 65 },
  { day: "Tue", value: 45 },
  { day: "Wed", value: 80 },
  { day: "Thu", value: 55 },
  { day: "Fri", value: 90 },
  { day: "Sat", value: 35 },
  { day: "Sun", value: 70 },
];

export const MOCK_PLATFORM_BREAKDOWN: MockPlatformBreakdown[] = [
  { platform: "Reddit", count: 18, color: "bg-orange-500" },
  { platform: "Hacker News", count: 12, color: "bg-amber-500" },
  { platform: "Product Hunt", count: 8, color: "bg-red-500" },
  { platform: "Trustpilot", count: 6, color: "bg-emerald-500" },
  { platform: "G2", count: 5, color: "bg-orange-600" },
  { platform: "YouTube", count: 3, color: "bg-red-600" },
];

export const MOCK_SENTIMENT_TOTALS = {
  positive: 28,
  negative: 9,
  neutral: 5,
};
