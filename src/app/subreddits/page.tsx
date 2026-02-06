import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Users, TrendingUp, Zap } from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { ALL_TRACKED_SUBREDDITS } from "@/lib/data/tracked-subreddits";
import { db } from "@/lib/db";
import { communityGrowth } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import { Metadata } from "next";

export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: "Monitor Any Subreddit | Reddit Monitoring Tool | Kaulby",
  description: "Track brand mentions, find customers, and analyze sentiment across 100+ popular subreddits. AI-powered Reddit monitoring for businesses and startups.",
  keywords: [
    "reddit monitoring",
    "subreddit tracking",
    "reddit brand mentions",
    "social listening reddit",
    "reddit sentiment analysis",
    "community monitoring",
  ],
  openGraph: {
    title: "Monitor Any Subreddit | Kaulby",
    description: "Track brand mentions, find customers, and analyze sentiment across 100+ popular subreddits.",
    type: "website",
    url: "https://kaulbyapp.com/subreddits",
  },
};

// Categorize subreddits for display
const categories: Record<string, { name: string; subreddits: string[] }> = {
  business: {
    name: "Business & Startups",
    subreddits: ["startups", "entrepreneur", "smallbusiness", "SaaS", "startup", "ecommerce", "sidehustle", "venturecapital"],
  },
  marketing: {
    name: "Marketing & Growth",
    subreddits: ["marketing", "socialmedia", "digital_marketing", "SEO", "PPC", "content_marketing", "GrowthHacking"],
  },
  technology: {
    name: "Technology & Development",
    subreddits: ["webdev", "programming", "javascript", "reactjs", "nextjs", "Python", "machinelearning", "devops"],
  },
  finance: {
    name: "Finance & Investing",
    subreddits: ["personalfinance", "investing", "stocks", "CryptoCurrency", "financialindependence"],
  },
  productivity: {
    name: "Productivity & Tools",
    subreddits: ["productivity", "Notion", "nocode", "selfhosted", "Airtable"],
  },
  indie: {
    name: "Indie Hackers & Makers",
    subreddits: ["SideProject", "indiebiz", "IMadeThis", "AlphaAndBetaUsers", "microsaas"],
  },
};

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
 * Fetch stats for all tracked subreddits
 */
async function getAllSubredditStats() {
  try {
    const identifiers = ALL_TRACKED_SUBREDDITS.map(s => `r/${s}`);
    // DB: Bounded query on static identifier list — FIX-102
    const stats = await db.query.communityGrowth.findMany({
      where: inArray(communityGrowth.identifier, identifiers),
      orderBy: [desc(communityGrowth.recordedAt)],
    });

    // Dedupe to get latest stats per subreddit
    const latestStats: Record<string, { memberCount: number; postsPerDay: number }> = {};
    for (const stat of stats) {
      const slug = stat.identifier.replace("r/", "");
      if (!latestStats[slug]) {
        latestStats[slug] = {
          memberCount: stat.memberCount || 0,
          postsPerDay: stat.postCountDaily || 0,
        };
      }
    }
    return latestStats;
  } catch {
    return {};
  }
}

export default async function SubredditsIndexPage() {
  const stats = await getAllSubredditStats();

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
            Monitor <span className="text-primary">Any Subreddit</span>
            <br />
            with AI-Powered Insights
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Track brand mentions, find potential customers, and analyze sentiment across
            {" "}{ALL_TRACKED_SUBREDDITS.length}+ popular subreddits for business and startups.
          </p>

          {/* Search Box */}
          <div className="max-w-md mx-auto relative mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a subreddit..."
              className="pl-10 py-6 text-lg"
              disabled
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              Coming soon
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up?ref=subreddits">
              <Button size="lg" className="gap-2 text-lg px-8">
                Start Monitoring Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="py-8 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold">{ALL_TRACKED_SUBREDDITS.length}+</div>
              <div className="text-sm opacity-80">Subreddits Tracked</div>
            </div>
            <div>
              <div className="text-3xl font-bold">16</div>
              <div className="text-sm opacity-80">Platforms Supported</div>
            </div>
            <div>
              <div className="text-3xl font-bold">AI</div>
              <div className="text-sm opacity-80">Powered Analysis</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {Object.entries(categories).map(([key, category]) => (
        <section key={key} className="py-12 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-2xl font-bold mb-6">{category.name}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {category.subreddits.map((sub) => {
                const subStats = stats[sub];
                return (
                  <Link key={sub} href={`/subreddits/${sub}`}>
                    <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">r/{sub}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {subStats?.memberCount ? (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {formatNumber(subStats.memberCount)}
                            </div>
                          ) : null}
                          {subStats?.postsPerDay ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              {subStats.postsPerDay}/day
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* All Subreddits */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold mb-6">All Tracked Subreddits</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_TRACKED_SUBREDDITS.map((sub) => (
              <Link key={sub} href={`/subreddits/${sub}`}>
                <Badge variant="outline" className="px-3 py-1 cursor-pointer hover:bg-muted">
                  r/{sub}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Why Monitor Reddit?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Find Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Discover users actively looking for solutions like yours. Engage at the
                  right moment when they&apos;re ready to buy.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Track Competitors</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Monitor what people say about your competitors. Find opportunities
                  when users express frustration with alternatives.
                </CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Protect Your Brand</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Get instant alerts when your brand is mentioned. Respond quickly to
                  both positive feedback and concerns.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Monitoring Reddit Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join thousands of businesses using Kaulby to track Reddit conversations
            and find customers.
          </p>
          <Link href="/sign-up?ref=subreddits">
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* SECURITY: XSS prevention — FIX-007
          Schema.org structured data uses JSON.stringify on static data (ALL_TRACKED_SUBREDDITS),
          not user input. This is safe for SEO/AEO purposes. */}
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Reddit Subreddit Monitoring | Kaulby",
            description: "Track brand mentions across 100+ popular subreddits with AI-powered monitoring.",
            url: "https://kaulbyapp.com/subreddits",
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: ALL_TRACKED_SUBREDDITS.length,
              itemListElement: ALL_TRACKED_SUBREDDITS.slice(0, 20).map((sub, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: `https://kaulbyapp.com/subreddits/${sub}`,
                name: `Monitor r/${sub}`,
              })),
            },
          }),
        }}
      />

      <MarketingFooter />
    </div>
  );
}
