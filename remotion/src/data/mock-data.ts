// Realistic demo data matching the actual Kaulby dashboard UI

export interface Monitor {
  id: string;
  name: string;
  status: "active" | "paused";
  keywords: string[];
  platforms: string[];
  lastRefreshed: string;
}

export interface ResultItem {
  id: string;
  platform: string;
  title: string;
  monitorName: string;
  author: string;
  date: string;
  sentiment: "positive" | "negative" | "neutral";
  category: string;
  categoryColor: string;
  categoryIcon: string;
  leadScore: number;
  leadLabel: string;
  isNew: boolean;
  aiSummary: string;
}

export interface TopicCard {
  id: string;
  topic: string;
  monitors: string[];
  trend: "rising" | "falling" | "stable";
  mentions: number;
  platforms: { name: string; color: string }[];
  sentimentPositive: number;
  sentimentNegative: number;
  sentimentNeutral: number;
  keywords: string[];
  isAIPick?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  citations?: {
    platform: string;
    monitor: string;
    title: string;
    snippet: string;
  }[];
}

// --- Monitors ---

export const monitors: Monitor[] = [
  {
    id: "mon_1",
    name: "Trellis Brand Monitor",
    status: "active",
    keywords: ["trellis app", "trellis review", "trellis vs"],
    platforms: ["Reddit", "Hacker News", "Product Hunt", "Trustpilot"],
    lastRefreshed: "2h ago",
  },
  {
    id: "mon_2",
    name: "Competitor Watch",
    status: "active",
    keywords: ["linear vs", "notion alternative"],
    platforms: ["Reddit", "G2"],
    lastRefreshed: "4h ago",
  },
  {
    id: "mon_3",
    name: "Customer Feedback",
    status: "active",
    keywords: ["trellis support", "trellis bug"],
    platforms: ["Trustpilot", "Google Reviews"],
    lastRefreshed: "1h ago",
  },
];

// --- Platform colors for badges ---

export const platformColors: Record<string, string> = {
  Reddit: "hsl(16, 100%, 50%)",
  "Hacker News": "hsl(24, 100%, 50%)",
  "Product Hunt": "hsl(14, 72%, 52%)",
  Trustpilot: "hsl(142, 71%, 45%)",
  G2: "hsl(24, 100%, 40%)",
  YouTube: "hsl(0, 100%, 50%)",
  "Google Reviews": "hsl(44, 100%, 48%)",
  GitHub: "hsl(0, 0%, 65%)",
  "Dev.to": "hsl(0, 0%, 80%)",
  Hashnode: "hsl(225, 100%, 60%)",
  "App Store": "hsl(210, 100%, 50%)",
  "Play Store": "hsl(142, 60%, 50%)",
  Quora: "hsl(0, 75%, 50%)",
  Yelp: "hsl(0, 100%, 45%)",
  "Amazon Reviews": "hsl(35, 100%, 50%)",
  "Indie Hackers": "hsl(210, 60%, 50%)",
  "X (Twitter)": "hsl(0, 0%, 80%)",
};

// --- Results ---

export const results: ResultItem[] = [
  {
    id: "res_1",
    platform: "Reddit",
    title: "Just tried Trellis and it completely replaced our Notion setup",
    monitorName: "Trellis Brand Monitor",
    author: "u/productivitynerd",
    date: "Mar 10, 2026",
    sentiment: "positive",
    category: "Looking for Solution",
    categoryColor: "hsl(142, 71%, 45%)",
    categoryIcon: "target",
    leadScore: 85,
    leadLabel: "Hot",
    isNew: true,
    aiSummary:
      "User praises Trellis for replacing their Notion workflow. Highlights include better collaboration features and faster load times. Strong purchase intent signal.",
  },
  {
    id: "res_2",
    platform: "Hacker News",
    title: "Trellis vs Linear: Which project management tool is better for startups?",
    monitorName: "Trellis Brand Monitor",
    author: "techfounder42",
    date: "Mar 10, 2026",
    sentiment: "neutral",
    category: "Advice",
    categoryColor: "hsl(210, 80%, 55%)",
    categoryIcon: "help",
    leadScore: 62,
    leadLabel: "Warm",
    isNew: true,
    aiSummary:
      "Comparison thread between Trellis and Linear. Mixed opinions with Trellis favored for non-technical teams. Key differentiator: AI features.",
  },
  {
    id: "res_3",
    platform: "Trustpilot",
    title: "Terrible customer support, 3 days for a response",
    monitorName: "Customer Feedback",
    author: "Sarah M.",
    date: "Mar 9, 2026",
    sentiment: "negative",
    category: "Pain Point",
    categoryColor: "hsl(0, 84%, 60%)",
    categoryIcon: "alert",
    leadScore: 30,
    leadLabel: "Cold",
    isNew: false,
    aiSummary:
      "Customer reports slow support response times (3 days). Specifically mentions billing issue unresolved. Churn risk - recommend immediate outreach.",
  },
  {
    id: "res_4",
    platform: "Product Hunt",
    title: "Trellis 2.0 launch - AI-powered project management",
    monitorName: "Trellis Brand Monitor",
    author: "trellis_team",
    date: "Mar 8, 2026",
    sentiment: "positive",
    category: "Trending",
    categoryColor: "hsl(270, 60%, 55%)",
    categoryIcon: "trending",
    leadScore: 78,
    leadLabel: "Hot",
    isNew: false,
    aiSummary:
      "Product Hunt launch with 340+ upvotes. Community highlights AI task prioritization. Several comparison requests with Monday.com.",
  },
];

// --- Insights Topics ---

export const topics: TopicCard[] = [
  {
    id: "topic_1",
    topic: "AI-powered project management",
    monitors: ["Trellis Brand Monitor", "Competitor Watch"],
    trend: "rising",
    mentions: 34,
    platforms: [
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
      { name: "Hacker News", color: "hsl(24, 100%, 50%)" },
      { name: "Product Hunt", color: "hsl(14, 72%, 52%)" },
    ],
    sentimentPositive: 22,
    sentimentNegative: 4,
    sentimentNeutral: 8,
    keywords: ["AI features", "automation", "smart tasks"],
    isAIPick: true,
  },
  {
    id: "topic_2",
    topic: "Customer support response times",
    monitors: ["Customer Feedback"],
    trend: "rising",
    mentions: 18,
    platforms: [
      { name: "Trustpilot", color: "hsl(142, 71%, 45%)" },
      { name: "Google Reviews", color: "hsl(44, 100%, 48%)" },
    ],
    sentimentPositive: 3,
    sentimentNegative: 12,
    sentimentNeutral: 3,
    keywords: ["slow response", "support ticket", "waiting"],
  },
  {
    id: "topic_3",
    topic: "Pricing comparison vs Linear",
    monitors: ["Competitor Watch"],
    trend: "stable",
    mentions: 12,
    platforms: [
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
      { name: "G2", color: "hsl(24, 100%, 40%)" },
    ],
    sentimentPositive: 5,
    sentimentNegative: 3,
    sentimentNeutral: 4,
    keywords: ["pricing", "value", "free tier"],
  },
  {
    id: "topic_4",
    topic: "Migration from Notion",
    monitors: ["Trellis Brand Monitor"],
    trend: "rising",
    mentions: 15,
    platforms: [
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
      { name: "Hacker News", color: "hsl(24, 100%, 50%)" },
    ],
    sentimentPositive: 10,
    sentimentNegative: 2,
    sentimentNeutral: 3,
    keywords: ["migration", "import", "switch"],
  },
];

// --- Create Monitor Form Data ---

export const createMonitorForm = {
  companyName: "Trellis",
  monitorName: "Trellis Monitor",
  keywords: ["trellis app", "trellis review", "trellis alternative", "trellis vs"],
  platforms: [
    {
      name: "Reddit",
      description: "Track subreddits and discussions",
      tier: "free" as const,
      checked: true,
    },
    {
      name: "Hacker News",
      description: "Tech and startup discussions",
      tier: "pro" as const,
      checked: true,
    },
    {
      name: "Product Hunt",
      description: "Product launches and reviews",
      tier: "pro" as const,
      checked: true,
    },
    {
      name: "Trustpilot",
      description: "Customer reviews and ratings",
      tier: "pro" as const,
      checked: false, // will animate to checked
    },
    {
      name: "Dev.to",
      description: "Developer blog posts",
      tier: "team" as const,
      checked: false,
      locked: true,
    },
    {
      name: "Hashnode",
      description: "Developer articles",
      tier: "team" as const,
      checked: false,
      locked: true,
    },
  ],
};

// --- AI Chat Messages ---

export const chatMessages: ChatMessage[] = [
  {
    role: "user",
    content: "What are the top pain points this week?",
  },
  {
    role: "assistant",
    content:
      "Based on analysis of **42 results** across your monitors this week, here are the top pain points:\n\n**1. Customer Support Response Times** (12 mentions)\nMultiple Trustpilot and Google Reviews mentions cite 2-3 day response times. Sentiment is **72% negative** on this topic.\n\n**2. Pricing Concerns** (8 mentions)\nReddit and G2 discussions compare Trellis pricing unfavorably to Linear's free tier.\n\n**3. Mobile App Performance** (6 mentions)\nPlay Store reviews mention slow loading and occasional crashes on Android.",
    tools: ["Searched 42 results", "Analyzed sentiment"],
    citations: [
      {
        platform: "Trustpilot",
        monitor: "Customer Feedback",
        title: "Terrible customer support, 3 days for a response",
        snippet: "Had a billing issue and waited 3 full days for any response...",
      },
      {
        platform: "Reddit",
        monitor: "Competitor Watch",
        title: "Trellis pricing is getting out of hand",
        snippet: "Linear offers way more on their free plan. Trellis needs to catch up...",
      },
    ],
  },
  {
    role: "user",
    content: "Which monitors have the most negative sentiment?",
  },
  {
    role: "assistant",
    content:
      "**Customer Feedback** has the highest negative sentiment at **67%**, driven by Trustpilot reviews about support times.\n\n**Competitor Watch** follows at **38%** negative, mostly pricing threads on Reddit.",
    tools: ["Analyzed 3 monitors"],
  },
];

// --- Sidebar Nav Items ---

export const sidebarNavItems = [
  { label: "Overview", icon: "layout" },
  { label: "Monitors", icon: "radio" },
  { label: "Audiences", icon: "users" },
  { label: "Results", icon: "list" },
  { label: "Bookmarks", icon: "bookmark" },
  { label: "Analytics", icon: "chart" },
  { label: "Insights", icon: "sparkles" },
  { label: "Ask Kaulby AI", icon: "bot" },
  { label: "Settings", icon: "settings" },
  { label: "Help", icon: "help" },
];

// --- Chat Suggested Questions ---

export const suggestedQuestions = [
  "What are people saying about my brand?",
  "Show me high-intent leads",
  "Which platforms have the most negative sentiment?",
];

// --- Pain Points Data (NEW) ---

export interface PainPoint {
  category: string;
  label: string;
  icon: string; // "shield" | "wrench" | "dollar" | "users" | "lightbulb"
  iconColor: string;
  severity: number;
  count: number;
  trend: "rising" | "falling" | "stable";
  platforms: { name: string; color: string }[];
  sentimentBreakdown: { positive: number; negative: number; neutral: number };
  keywords: string[];
  topMention: { title: string; platform: string; author: string };
}

export const painPoints: PainPoint[] = [
  {
    category: "negative_experience",
    label: "Negative Experiences",
    icon: "shield",
    iconColor: "hsl(0, 84%, 60%)",
    severity: 5,
    count: 14,
    trend: "rising",
    platforms: [
      { name: "Trustpilot", color: "hsl(142, 71%, 45%)" },
      { name: "Google Reviews", color: "hsl(44, 100%, 48%)" },
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
    ],
    sentimentBreakdown: { positive: 1, negative: 11, neutral: 2 },
    keywords: ["slow response", "billing issue", "unresolved"],
    topMention: { title: "Terrible customer support, 3 days for a response", platform: "Trustpilot", author: "Sarah M." },
  },
  {
    category: "support_need",
    label: "Support Needs",
    icon: "wrench",
    iconColor: "hsl(24, 100%, 50%)",
    severity: 4,
    count: 9,
    trend: "stable",
    platforms: [
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
      { name: "Hacker News", color: "hsl(24, 100%, 50%)" },
    ],
    sentimentBreakdown: { positive: 2, negative: 5, neutral: 2 },
    keywords: ["how to", "setup", "integration help"],
    topMention: { title: "How do I connect Trellis to Slack?", platform: "Reddit", author: "u/devops_daily" },
  },
  {
    category: "pricing_concern",
    label: "Pricing Concerns",
    icon: "dollar",
    iconColor: "hsl(45, 93%, 47%)",
    severity: 3,
    count: 8,
    trend: "rising",
    platforms: [
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
      { name: "G2", color: "hsl(24, 100%, 40%)" },
    ],
    sentimentBreakdown: { positive: 1, negative: 5, neutral: 2 },
    keywords: ["expensive", "free tier", "pricing"],
    topMention: { title: "Trellis pricing vs Linear — is it worth it?", platform: "Reddit", author: "u/bootstrapper" },
  },
  {
    category: "competitor_mention",
    label: "Competitor Mentions",
    icon: "users",
    iconColor: "hsl(210, 80%, 55%)",
    severity: 3,
    count: 12,
    trend: "stable",
    platforms: [
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
      { name: "Hacker News", color: "hsl(24, 100%, 50%)" },
      { name: "G2", color: "hsl(24, 100%, 40%)" },
    ],
    sentimentBreakdown: { positive: 4, negative: 3, neutral: 5 },
    keywords: ["linear", "notion", "monday.com", "alternative"],
    topMention: { title: "Switching from Notion to Trellis — worth it?", platform: "Hacker News", author: "startup_pm" },
  },
  {
    category: "feature_request",
    label: "Feature Requests",
    icon: "lightbulb",
    iconColor: "hsl(270, 60%, 55%)",
    severity: 2,
    count: 6,
    trend: "falling",
    platforms: [
      { name: "Reddit", color: "hsl(16, 100%, 50%)" },
      { name: "Product Hunt", color: "hsl(14, 72%, 52%)" },
    ],
    sentimentBreakdown: { positive: 3, negative: 1, neutral: 2 },
    keywords: ["mobile app", "calendar view", "API"],
    topMention: { title: "Feature request: calendar view in Trellis", platform: "Product Hunt", author: "pm_daily" },
  },
];

// --- Recommendations Data (NEW) ---

export interface Recommendation {
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  priorityColor: string;
  category: string;
  categoryIcon: string;
  impact: string;
  effort: string;
  actions: string[];
}

export const recommendations: Recommendation[] = [
  {
    title: "Reduce Support Response Time to Under 24 Hours",
    description: "14 negative mentions cite 2-3 day response times. This is your #1 churn risk.",
    priority: "critical",
    priorityColor: "hsl(0, 84%, 60%)",
    category: "Customer Service",
    categoryIcon: "users",
    impact: "Could reduce churn by 30% based on complaint volume",
    effort: "Quick Win",
    actions: ["Hire part-time support agent or implement chatbot for tier-1 issues", "Set up auto-acknowledgement emails within 1 hour", "Create FAQ page for common billing questions"],
  },
  {
    title: "Address Pricing Perception vs Linear",
    description: "8 mentions compare your pricing unfavorably to Linear's free tier. Users see less value at the same price point.",
    priority: "high",
    priorityColor: "hsl(24, 100%, 50%)",
    category: "Pricing",
    categoryIcon: "dollar",
    impact: "Directly affects conversion from trial to paid",
    effort: "Moderate Effort",
    actions: ["Create comparison landing page highlighting unique features", "Consider expanding free tier with 1-2 differentiating features", "Add ROI calculator showing time saved vs manual tracking"],
  },
  {
    title: "Publish Integration Setup Guides",
    description: "9 support-need mentions ask how to connect to Slack, Jira, and GitHub. Documentation gap is causing friction.",
    priority: "medium",
    priorityColor: "hsl(45, 93%, 47%)",
    category: "Documentation",
    categoryIcon: "book",
    impact: "Reduce support tickets by 20-30%",
    effort: "Quick Win",
    actions: ["Write step-by-step Slack integration guide", "Create video walkthrough for top 3 integrations", "Add in-app setup wizard for popular tools"],
  },
];
