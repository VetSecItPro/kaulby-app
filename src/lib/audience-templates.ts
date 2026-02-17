/**
 * Pre-built audience templates for quick setup.
 *
 * Each template provides a pre-configured audience with:
 * - Name and description
 * - Color and icon
 * - Suggested keywords for monitors
 * - Recommended platforms
 *
 * Templates help users reach their "aha moment" faster by
 * skipping the blank-canvas problem.
 */

export interface AudienceTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  category: "business" | "product" | "industry" | "competitive";
  suggestedKeywords: string[];
  suggestedPlatforms: string[];
  useCase: string; // One-liner explaining when to use this
}

export const AUDIENCE_TEMPLATES: AudienceTemplate[] = [
  // === Business Templates ===
  {
    id: "brand-mentions",
    name: "Brand Mentions",
    description: "Track all mentions of your brand across online communities.",
    color: "#3b82f6",
    icon: "megaphone",
    category: "business",
    suggestedKeywords: ["[your brand]", "[your product]", "[your domain]"],
    suggestedPlatforms: ["reddit", "hackernews", "producthunt", "x"],
    useCase: "Monitor your brand's online presence and reputation",
  },
  {
    id: "competitor-tracker",
    name: "Competitor Tracker",
    description: "Monitor competitor mentions, complaints, and user switching signals.",
    color: "#ef4444",
    icon: "swords",
    category: "competitive",
    suggestedKeywords: ["[competitor name]", "alternative to [competitor]", "switching from [competitor]", "vs [competitor]"],
    suggestedPlatforms: ["reddit", "hackernews", "g2", "trustpilot"],
    useCase: "Find users unhappy with competitors or evaluating alternatives",
  },
  {
    id: "buyer-intent",
    name: "Buyer Intent",
    description: "Capture high-intent discussions from people ready to buy in your space.",
    color: "#22c55e",
    icon: "target",
    category: "business",
    suggestedKeywords: ["looking for a tool", "best software for", "recommend a", "need help with", "budget for"],
    suggestedPlatforms: ["reddit", "hackernews", "quora", "x"],
    useCase: "Find warm leads actively seeking solutions you offer",
  },
  {
    id: "customer-feedback",
    name: "Customer Feedback",
    description: "Aggregate reviews and feedback about your product from all platforms.",
    color: "#f97316",
    icon: "message-circle",
    category: "product",
    suggestedKeywords: ["[your product] review", "[your product] experience", "[your product] support"],
    suggestedPlatforms: ["googlereviews", "trustpilot", "g2", "appstore", "playstore"],
    useCase: "Consolidate customer feedback from review sites",
  },
  {
    id: "feature-requests",
    name: "Feature Requests",
    description: "Track feature requests and unmet needs from your target audience.",
    color: "#8b5cf6",
    icon: "lightbulb",
    category: "product",
    suggestedKeywords: ["wish it had", "feature request", "would be great if", "missing feature", "need ability to"],
    suggestedPlatforms: ["reddit", "hackernews", "github", "producthunt"],
    useCase: "Feed your product roadmap with real user demand signals",
  },
  {
    id: "industry-trends",
    name: "Industry Trends",
    description: "Stay ahead of trends and hot topics in your industry.",
    color: "#14b8a6",
    icon: "trending-up",
    category: "industry",
    suggestedKeywords: ["[your industry]", "[your niche] trend", "future of [topic]", "[technology] adoption"],
    suggestedPlatforms: ["reddit", "hackernews", "devto", "hashnode", "x"],
    useCase: "Track emerging trends and conversations in your market",
  },
  {
    id: "saas-churn-signals",
    name: "SaaS Churn Signals",
    description: "Detect early churn signals — pricing complaints, support frustration, competitor curiosity.",
    color: "#ec4899",
    icon: "alert-triangle",
    category: "business",
    suggestedKeywords: ["too expensive", "cancelling", "switching away", "not worth", "terrible support", "downgrade"],
    suggestedPlatforms: ["reddit", "trustpilot", "g2", "x"],
    useCase: "Catch churn risk early and intervene before customers leave",
  },
  {
    id: "developer-sentiment",
    name: "Developer Sentiment",
    description: "Monitor what developers are saying about your API, SDK, or dev tools.",
    color: "#eab308",
    icon: "code",
    category: "product",
    suggestedKeywords: ["[your SDK]", "[your API]", "developer experience", "documentation", "integration"],
    suggestedPlatforms: ["hackernews", "github", "devto", "hashnode", "reddit"],
    useCase: "Understand developer sentiment and DX issues",
  },
  {
    id: "app-store-reviews",
    name: "App Store Reviews",
    description: "Track and analyze reviews from mobile app stores.",
    color: "#6366f1",
    icon: "smartphone",
    category: "product",
    suggestedKeywords: ["[your app name]", "crashes", "update", "love this app", "needs improvement"],
    suggestedPlatforms: ["appstore", "playstore"],
    useCase: "Monitor mobile app reviews and ratings trends",
  },
  {
    id: "hiring-signals",
    name: "Hiring & Job Market",
    description: "Track hiring discussions and job market trends in your space.",
    color: "#0ea5e9",
    icon: "briefcase",
    category: "industry",
    suggestedKeywords: ["hiring for", "job market", "looking for work", "salary for", "remote work"],
    suggestedPlatforms: ["reddit", "hackernews", "x", "indiehackers"],
    useCase: "Stay informed about talent trends and hiring patterns",
  },
  {
    id: "content-opportunities",
    name: "Content Opportunities",
    description: "Find questions and topics your audience cares about for content creation.",
    color: "#a855f7",
    icon: "pen-tool",
    category: "business",
    suggestedKeywords: ["how to", "tutorial", "guide for", "explain", "best practices", "tips for"],
    suggestedPlatforms: ["reddit", "quora", "hackernews", "devto"],
    useCase: "Discover high-demand content topics from real audience questions",
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Monitor buzz and feedback during a product launch or major release.",
    color: "#f43f5e",
    icon: "rocket",
    category: "product",
    suggestedKeywords: ["[your product] launch", "just launched", "new release", "[your product] update"],
    suggestedPlatforms: ["reddit", "hackernews", "producthunt", "x", "indiehackers"],
    useCase: "Track launch day buzz and early user reactions",
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: "business" as const, label: "Business" },
  { id: "product" as const, label: "Product" },
  { id: "industry" as const, label: "Industry" },
  { id: "competitive" as const, label: "Competitive" },
] as const;

export function getTemplateById(id: string): AudienceTemplate | undefined {
  return AUDIENCE_TEMPLATES.find((t) => t.id === id);
}
