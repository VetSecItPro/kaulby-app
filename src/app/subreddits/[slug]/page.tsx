// TODO: FIX-325 (LOW) - Add breadcrumb navigation for deep SEO pages
// This page and other programmatic SEO pages (e.g., /articles/[slug]) should include
// breadcrumbs for better UX and SEO. Example structure:
// Home > Subreddits > r/startups
// Implement with JSON-LD BreadcrumbList schema + visual breadcrumb component
// See: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { communityGrowth } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Metadata } from "next";

// ISR: Revalidate every 24 hours
export const revalidate = 86400;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Bell,
  Brain,
  LineChart,
  MessageSquare,
  Search,
  Zap,
  Users,
  TrendingUp,
  Activity,
} from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { ALL_TRACKED_SUBREDDITS } from "@/lib/data/tracked-subreddits";
import { SubredditSchema } from "@/lib/seo/structured-data";

// Subreddit metadata for SEO (descriptions, topics, use cases)
const subredditMetadata: Record<string, {
  description: string;
  topics: string[];
  useCase: string;
  industry?: string;
}> = {
  startups: {
    description: "The largest startup community on Reddit with founders sharing advice, asking for feedback, and discussing their journey.",
    topics: ["Startup advice", "Product feedback", "Founder experiences", "Fundraising"],
    useCase: "Track competitor mentions, find product feedback opportunities, and identify potential customers asking for solutions.",
    industry: "Startups",
  },
  saas: {
    description: "Community for SaaS founders and professionals discussing software-as-a-service businesses, growth strategies, and tools.",
    topics: ["SaaS growth", "Pricing strategies", "Churn reduction", "B2B sales"],
    useCase: "Monitor discussions about your product category, find users looking for alternatives to competitors, and gather market intelligence.",
    industry: "SaaS",
  },
  entrepreneur: {
    description: "One of the most active entrepreneurship communities with discussions on business ideas, marketing, and growth.",
    topics: ["Business ideas", "Marketing", "Sales", "Side projects"],
    useCase: "Identify potential customers discussing problems your product solves, track brand mentions, and find content marketing opportunities.",
    industry: "Business",
  },
  smallbusiness: {
    description: "Community for small business owners discussing operations, growth challenges, and sharing experiences.",
    topics: ["Operations", "Hiring", "Local marketing", "Finance"],
    useCase: "Find small business owners looking for tools and solutions, track competitor discussions, and gather customer insights.",
    industry: "Small Business",
  },
  webdev: {
    description: "Web development community discussing frameworks, tools, best practices, and career advice.",
    topics: ["Frontend", "Backend", "DevOps", "Career"],
    useCase: "Monitor discussions about developer tools, find users experiencing pain points your product addresses, and track technology trends.",
    industry: "Technology",
  },
  programming: {
    description: "General programming community with discussions on languages, tools, industry news, and best practices.",
    topics: ["Languages", "Tools", "Best practices", "Industry news"],
    useCase: "Track mentions of your developer tool, find users looking for alternatives, and identify emerging pain points in the dev community.",
    industry: "Technology",
  },
  marketing: {
    description: "Marketing professionals sharing strategies, discussing tools, and asking for advice.",
    topics: ["Digital marketing", "Content", "SEO", "Paid ads"],
    useCase: "Monitor discussions about marketing tools, find users looking for solutions, and track competitor mentions.",
    industry: "Marketing",
  },
  socialmedia: {
    description: "Community focused on social media marketing, platforms, and growth strategies.",
    topics: ["Platform updates", "Growth tactics", "Content strategy", "Analytics"],
    useCase: "Track discussions about social media tools, find users with pain points, and monitor industry trends.",
    industry: "Marketing",
  },
  productivity: {
    description: "Community dedicated to productivity tools, methods, and personal efficiency.",
    topics: ["Tools", "Methods", "Time management", "Habits"],
    useCase: "Find users looking for productivity solutions, track competitor mentions, and identify feature request opportunities.",
    industry: "Productivity",
  },
  sideproject: {
    description: "Makers and indie hackers sharing their side projects and gathering feedback.",
    topics: ["Indie hacking", "Project showcases", "Feedback", "Launch strategies"],
    useCase: "Monitor your product niche, find early adopters, and identify users actively building in your space.",
    industry: "Indie Hackers",
  },
  javascript: {
    description: "The JavaScript programming language community discussing frameworks, libraries, and best practices.",
    topics: ["Frameworks", "Libraries", "Node.js", "Frontend"],
    useCase: "Track discussions about JS tools and frameworks, find developers with pain points, and monitor ecosystem trends.",
    industry: "Technology",
  },
  reactjs: {
    description: "React.js community discussing components, hooks, state management, and React ecosystem.",
    topics: ["Components", "Hooks", "State management", "React ecosystem"],
    useCase: "Monitor React-related tool discussions, find developers seeking solutions, and track framework trends.",
    industry: "Technology",
  },
  nextjs: {
    description: "Next.js framework community discussing server components, routing, and full-stack development.",
    topics: ["Server components", "Routing", "Deployment", "Full-stack"],
    useCase: "Track Next.js ecosystem discussions, find developers with framework pain points, and monitor adoption trends.",
    industry: "Technology",
  },
  machinelearning: {
    description: "Machine learning community discussing algorithms, tools, papers, and applications.",
    topics: ["Algorithms", "Deep learning", "MLOps", "Research"],
    useCase: "Monitor ML tool discussions, find researchers and practitioners with pain points, and track AI trends.",
    industry: "AI/ML",
  },
  personalfinance: {
    description: "Personal finance community discussing budgeting, investing, and financial planning.",
    topics: ["Budgeting", "Investing", "Retirement", "Debt"],
    useCase: "Find users discussing financial tools, track fintech mentions, and identify pain points in money management.",
    industry: "Finance",
  },
  ecommerce: {
    description: "E-commerce community discussing online stores, platforms, marketing, and fulfillment.",
    topics: ["Platforms", "Marketing", "Fulfillment", "Dropshipping"],
    useCase: "Monitor e-commerce tool discussions, find store owners with pain points, and track industry trends.",
    industry: "E-commerce",
  },
};

const features = [
  {
    icon: Search,
    title: "Keyword Monitoring",
    description: "Track specific keywords, phrases, and your brand mentions across all posts and comments.",
  },
  {
    icon: Brain,
    title: "AI Sentiment Analysis",
    description: "Automatically categorize mentions as positive, negative, or neutral with AI-powered analysis.",
  },
  {
    icon: Bell,
    title: "Real-time Alerts",
    description: "Get instant notifications via email, Slack, or Discord when new mentions are found.",
  },
  {
    icon: LineChart,
    title: "Pain Point Detection",
    description: "AI identifies users expressing frustration or looking for solutions - perfect sales opportunities.",
  },
  {
    icon: MessageSquare,
    title: "Conversation Categorization",
    description: "Automatically tag discussions as feature requests, complaints, questions, or praise.",
  },
  {
    icon: Zap,
    title: "Boolean Search",
    description: "Use advanced search operators like AND, OR, NOT for precise monitoring.",
  },
];

/**
 * Fetch subreddit stats from database
 */
async function getSubredditStats(slug: string) {
  try {
    const stats = await db.query.communityGrowth.findFirst({
      where: and(
        eq(communityGrowth.platform, "reddit"),
        eq(communityGrowth.identifier, `r/${slug}`)
      ),
      orderBy: [desc(communityGrowth.recordedAt)],
    });
    return stats;
  } catch {
    return null;
  }
}

/**
 * Fetch real-time stats from Reddit API (fallback if not in DB)
 */
async function fetchLiveStats(slug: string) {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${slug}/about.json`,
      {
        headers: { "User-Agent": "Kaulby/1.0" },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      memberCount: data.data?.subscribers || 0,
      activeUsers: data.data?.accounts_active || 0,
      description: data.data?.public_description || data.data?.description || "",
    };
  } catch {
    return null;
  }
}

/**
 * Format large numbers for display
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`;
  }
  return num.toString();
}

/**
 * Get related subreddits from the same industry
 */
function getRelatedSubreddits(slug: string, industry?: string): string[] {
  const meta = subredditMetadata[slug];
  const targetIndustry = industry || meta?.industry;

  if (!targetIndustry) {
    // Return random tracked subreddits
    return ALL_TRACKED_SUBREDDITS.filter(s => s !== slug).slice(0, 6);
  }

  // Find subreddits in the same industry
  const related = Object.entries(subredditMetadata)
    .filter(([key, value]) => key !== slug && value.industry === targetIndustry)
    .map(([key]) => key);

  // If not enough, add from tracked list
  if (related.length < 6) {
    const additional = ALL_TRACKED_SUBREDDITS
      .filter(s => s !== slug && !related.includes(s))
      .slice(0, 6 - related.length);
    return [...related, ...additional];
  }

  return related.slice(0, 6);
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = subredditMetadata[slug];

  const title = `Monitor r/${slug} | Reddit Monitoring Tool | Kaulby`;
  const description = meta?.description ||
    `Track discussions, mentions, and conversations in r/${slug} with Kaulby's AI-powered community monitoring. Get real-time alerts and sentiment analysis.`;

  return {
    title,
    description,
    keywords: [
      `r/${slug} monitoring`,
      `reddit ${slug} tracking`,
      `${slug} mentions`,
      "reddit monitoring tool",
      "community monitoring",
      "brand monitoring",
      "social listening",
    ],
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://kaulbyapp.com/subreddits/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/subreddits/${slug}`,
    },
  };
}

// Generate static params for priority subreddits
export async function generateStaticParams() {
  // Pre-generate pages for all tracked subreddits
  return ALL_TRACKED_SUBREDDITS.map((slug) => ({ slug }));
}

export default async function SubredditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Normalize slug (lowercase, remove r/ prefix if present)
  const normalizedSlug = slug.toLowerCase().replace(/^r\//, "");

  // Get cached stats from database
  const dbStats = await getSubredditStats(normalizedSlug);

  // If not in DB, fetch live stats
  const liveStats = !dbStats ? await fetchLiveStats(normalizedSlug) : null;

  // If neither source has data and it's not a known subreddit, return 404
  if (!dbStats && !liveStats && !subredditMetadata[normalizedSlug] && !ALL_TRACKED_SUBREDDITS.includes(normalizedSlug)) {
    notFound();
  }

  // Get metadata (use defaults if not in our list)
  const meta = subredditMetadata[normalizedSlug] || {
    description: `Monitor discussions, mentions, and conversations in r/${normalizedSlug} with Kaulby's AI-powered community monitoring.`,
    topics: ["Discussions", "Mentions", "Questions", "Feedback"],
    useCase: "Track brand mentions, find potential customers, and gather market intelligence from this community.",
  };

  // Combine stats from all sources
  const memberCount = dbStats?.memberCount || liveStats?.memberCount || 0;
  const postsPerDay = dbStats?.postCountDaily || 0;
  const engagementRate = dbStats?.engagementRate || 0;

  const relatedSubreddits = getRelatedSubreddits(normalizedSlug, meta.industry);

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            Reddit Monitoring
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Monitor <span className="text-primary">r/{normalizedSlug}</span>
            <br />
            with AI-Powered Insights
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {meta.description}
          </p>

          {/* Stats Cards */}
          {memberCount > 0 && (
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">{formatNumber(memberCount)}</div>
                <div className="text-xs text-muted-foreground">Members</div>
              </div>
              {postsPerDay > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold">{postsPerDay}</div>
                  <div className="text-xs text-muted-foreground">Posts/Day</div>
                </div>
              )}
              {engagementRate > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(engagementRate)}</div>
                  <div className="text-xs text-muted-foreground">Avg Engagement</div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=subreddit-${normalizedSlug}`}>
              <Button size="lg" className="gap-2 text-lg px-8">
                Start Monitoring r/{normalizedSlug}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Free tier available. No credit card required.
          </p>
        </div>
      </section>

      {/* Topics */}
      <section className="py-12 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-center mb-6">Popular Topics in r/{normalizedSlug}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {meta.topics.map((topic) => (
              <Badge key={topic} variant="outline" className="text-base px-4 py-2">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Use Case */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">Why Monitor r/{normalizedSlug}?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-muted-foreground">{meta.useCase}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">How Kaulby Monitors r/{normalizedSlug}</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Comprehensive Reddit monitoring with AI-powered analysis and instant alerts.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Get Started in 3 Steps</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Create Monitor</h3>
              <p className="text-muted-foreground">
                Add r/{normalizedSlug} and set your keywords - brand name, competitors, or topics.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Analyzes</h3>
              <p className="text-muted-foreground">
                Kaulby scans posts and comments, analyzing sentiment and categorizing conversations.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Get Alerts</h3>
              <p className="text-muted-foreground">
                Receive instant notifications when relevant discussions happen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Monitoring r/{normalizedSlug} Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join thousands of businesses using Kaulby to track Reddit conversations and find customers.
          </p>
          <Link href={`/sign-up?ref=subreddit-${normalizedSlug}`}>
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Other Subreddits */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">Monitor Other Popular Subreddits</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {relatedSubreddits.map((sub) => (
              <Link key={sub} href={`/subreddits/${sub}`}>
                <Badge variant="outline" className="text-base px-4 py-2 cursor-pointer hover:bg-muted">
                  r/{sub}
                </Badge>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/subreddits">
              <Button variant="outline">
                View All Subreddits
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Schema.org Structured Data */}
      <SubredditSchema
        subreddit={normalizedSlug}
        description={meta.description}
        memberCount={memberCount}
      />

      <MarketingFooter />
    </div>
  );
}
