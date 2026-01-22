/**
 * Community Suggestions Algorithm
 * Suggests relevant communities based on user's monitors and keywords
 */

// Popular subreddits categorized by topic
// This is a curated list - in production, this could be enhanced with API data
const SUBREDDIT_CATEGORIES: Record<string, string[]> = {
  // Startups & Business
  startup: [
    "r/startups",
    "r/Entrepreneur",
    "r/smallbusiness",
    "r/SaaS",
    "r/indiehackers",
    "r/growmybusiness",
    "r/EntrepreneurRideAlong",
    "r/sweatystartup",
  ],
  saas: [
    "r/SaaS",
    "r/microsaas",
    "r/SideProject",
    "r/startups",
    "r/indiehackers",
    "r/webdev",
    "r/programming",
  ],
  marketing: [
    "r/marketing",
    "r/digital_marketing",
    "r/SEO",
    "r/socialmedia",
    "r/PPC",
    "r/content_marketing",
    "r/copywriting",
    "r/GrowthHacking",
  ],
  sales: [
    "r/sales",
    "r/B2BSales",
    "r/salesforce",
    "r/coldcalling",
    "r/InsideSales",
  ],
  // Technology
  programming: [
    "r/programming",
    "r/learnprogramming",
    "r/webdev",
    "r/javascript",
    "r/Python",
    "r/reactjs",
    "r/node",
    "r/golang",
  ],
  ai: [
    "r/artificial",
    "r/MachineLearning",
    "r/deeplearning",
    "r/OpenAI",
    "r/LocalLLaMA",
    "r/ChatGPT",
    "r/singularity",
    "r/ArtificialIntelligence",
  ],
  devops: [
    "r/devops",
    "r/kubernetes",
    "r/docker",
    "r/aws",
    "r/googlecloud",
    "r/terraform",
    "r/sysadmin",
  ],
  mobile: [
    "r/androiddev",
    "r/iOSProgramming",
    "r/reactnative",
    "r/FlutterDev",
    "r/SwiftUI",
  ],
  // Products & Tools
  productivity: [
    "r/productivity",
    "r/Notion",
    "r/todoist",
    "r/ObsidianMD",
    "r/RoamResearch",
    "r/PKMS",
    "r/Zettelkasten",
  ],
  nocode: [
    "r/nocode",
    "r/Webflow",
    "r/Airtable",
    "r/zapier",
    "r/bubble",
    "r/retool",
  ],
  design: [
    "r/design",
    "r/web_design",
    "r/UI_Design",
    "r/userexperience",
    "r/Figma",
    "r/graphic_design",
  ],
  // Finance & Investing
  finance: [
    "r/personalfinance",
    "r/investing",
    "r/stocks",
    "r/financialindependence",
    "r/fatFIRE",
  ],
  crypto: [
    "r/CryptoCurrency",
    "r/Bitcoin",
    "r/ethereum",
    "r/defi",
    "r/web3",
  ],
  // Lifestyle & General
  selfimprovement: [
    "r/selfimprovement",
    "r/getdisciplined",
    "r/DecidingToBeBetter",
    "r/Stoicism",
  ],
  career: [
    "r/careerguidance",
    "r/cscareerquestions",
    "r/jobs",
    "r/resumes",
    "r/remotework",
  ],
  freelance: [
    "r/freelance",
    "r/Upwork",
    "r/WorkOnline",
    "r/digitalnomad",
    "r/Fiverr",
  ],
};

// Keywords that map to categories
const KEYWORD_TO_CATEGORY: Record<string, string[]> = {
  // Startup keywords
  startup: ["startup"],
  founder: ["startup"],
  bootstrapped: ["startup", "saas"],
  mvp: ["startup", "saas"],
  venture: ["startup", "finance"],
  seed: ["startup", "finance"],
  investor: ["startup", "finance"],

  // SaaS keywords
  saas: ["saas", "startup"],
  subscription: ["saas"],
  mrr: ["saas", "startup"],
  churn: ["saas"],
  b2b: ["saas", "sales"],
  api: ["saas", "programming"],

  // Marketing keywords
  marketing: ["marketing"],
  seo: ["marketing"],
  content: ["marketing"],
  social: ["marketing"],
  ads: ["marketing"],
  growth: ["marketing", "startup"],
  conversion: ["marketing", "sales"],
  landing: ["marketing", "design"],

  // Sales keywords
  sales: ["sales"],
  crm: ["sales", "saas"],
  lead: ["sales", "marketing"],
  pipeline: ["sales"],
  outbound: ["sales"],
  cold: ["sales"],

  // Tech keywords
  programming: ["programming"],
  code: ["programming"],
  developer: ["programming", "career"],
  software: ["programming", "saas"],
  app: ["programming", "mobile"],
  web: ["programming", "design"],
  javascript: ["programming"],
  python: ["programming"],
  react: ["programming"],
  node: ["programming"],

  // AI keywords
  ai: ["ai"],
  artificial: ["ai"],
  machine: ["ai"],
  learning: ["ai"],
  gpt: ["ai"],
  llm: ["ai"],
  chatgpt: ["ai"],
  openai: ["ai"],
  claude: ["ai"],

  // DevOps keywords
  devops: ["devops"],
  cloud: ["devops"],
  kubernetes: ["devops"],
  docker: ["devops"],
  aws: ["devops"],
  infrastructure: ["devops"],
  deploy: ["devops"],

  // Mobile keywords
  mobile: ["mobile"],
  ios: ["mobile"],
  android: ["mobile"],
  flutter: ["mobile"],

  // Productivity keywords
  productivity: ["productivity"],
  notion: ["productivity", "nocode"],
  workflow: ["productivity", "nocode"],
  automation: ["productivity", "nocode"],
  tool: ["productivity", "saas"],

  // No-code keywords
  nocode: ["nocode"],
  lowcode: ["nocode"],
  webflow: ["nocode", "design"],
  airtable: ["nocode"],
  zapier: ["nocode"],

  // Design keywords
  design: ["design"],
  ui: ["design"],
  ux: ["design"],
  figma: ["design"],
  user: ["design"],

  // Finance keywords
  finance: ["finance"],
  invest: ["finance"],
  stock: ["finance"],
  money: ["finance"],
  budget: ["finance"],

  // Crypto keywords
  crypto: ["crypto"],
  bitcoin: ["crypto"],
  ethereum: ["crypto"],
  blockchain: ["crypto"],
  web3: ["crypto"],
  defi: ["crypto"],

  // Career keywords
  career: ["career"],
  job: ["career"],
  remote: ["career", "freelance"],
  work: ["career"],
  hire: ["career", "startup"],

  // Freelance keywords
  freelance: ["freelance"],
  contractor: ["freelance"],
  consultant: ["freelance"],
  gig: ["freelance"],
};

export interface CommunitySuggestion {
  community: string;
  platform: "reddit";
  relevanceScore: number;
  matchedKeywords: string[];
  categories: string[];
}

/**
 * Get community suggestions based on user's keywords
 */
export function getCommunitySuggestions(
  keywords: string[],
  existingCommunities: string[] = [],
  limit: number = 10
): CommunitySuggestion[] {
  const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());
  const normalizedExisting = new Set(
    existingCommunities.map((c) => c.toLowerCase())
  );

  // Track scores for each community
  const communityScores: Map<
    string,
    { score: number; keywords: Set<string>; categories: Set<string> }
  > = new Map();

  // For each keyword, find matching categories and their communities
  for (const keyword of normalizedKeywords) {
    // Check direct matches first
    const matchedCategories: string[] = [];

    // Check if keyword directly maps to categories
    for (const [term, categories] of Object.entries(KEYWORD_TO_CATEGORY)) {
      if (keyword.includes(term) || term.includes(keyword)) {
        matchedCategories.push(...categories);
      }
    }

    // If no direct match, check if keyword appears in category name
    if (matchedCategories.length === 0) {
      for (const category of Object.keys(SUBREDDIT_CATEGORIES)) {
        if (keyword.includes(category) || category.includes(keyword)) {
          matchedCategories.push(category);
        }
      }
    }

    // Add communities from matched categories
    for (const category of Array.from(new Set(matchedCategories))) {
      const communities = SUBREDDIT_CATEGORIES[category] || [];
      for (const community of communities) {
        // Skip if already in user's existing communities
        if (normalizedExisting.has(community.toLowerCase())) continue;

        const existing = communityScores.get(community);
        if (existing) {
          existing.score += 1;
          existing.keywords.add(keyword);
          existing.categories.add(category);
        } else {
          communityScores.set(community, {
            score: 1,
            keywords: new Set([keyword]),
            categories: new Set([category]),
          });
        }
      }
    }
  }

  // Convert to array and sort by score
  const suggestions: CommunitySuggestion[] = Array.from(
    communityScores.entries()
  )
    .map(([community, data]) => ({
      community,
      platform: "reddit" as const,
      relevanceScore: data.score,
      matchedKeywords: Array.from(data.keywords),
      categories: Array.from(data.categories),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  return suggestions;
}

/**
 * Get suggested communities for a user based on their monitors
 */
export function getSuggestionsFromMonitors(
  monitors: Array<{ keywords: string[]; platforms?: string[] }>,
  existingCommunities: string[] = [],
  limit: number = 10
): CommunitySuggestion[] {
  // Collect all keywords from monitors
  const allKeywords: string[] = [];
  for (const monitor of monitors) {
    allKeywords.push(...monitor.keywords);
  }

  // Get unique keywords
  const uniqueKeywords = Array.from(new Set(allKeywords));

  return getCommunitySuggestions(uniqueKeywords, existingCommunities, limit);
}
