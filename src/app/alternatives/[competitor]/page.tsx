"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X, ArrowRight } from "lucide-react";

// Competitor data for comparison pages
const competitorData: Record<string, {
  name: string;
  tagline: string;
  description: string;
  pricing: string;
  limitations: string[];
  features: Array<{
    feature: string;
    competitor: boolean | string;
    kaulby: boolean | string;
  }>;
}> = {
  mention: {
    name: "Mention",
    tagline: "Social Listening Tool",
    description: "Mention is a media monitoring tool that tracks brand mentions across social media, news, and blogs.",
    pricing: "Starts at $41/month",
    limitations: [
      "Limited Reddit coverage",
      "No AI sentiment analysis on lower tiers",
      "Expensive for startups",
      "No pain point detection",
    ],
    features: [
      { feature: "Reddit Monitoring", competitor: "Limited", kaulby: true },
      { feature: "Hacker News Monitoring", competitor: false, kaulby: true },
      { feature: "Product Hunt Monitoring", competitor: false, kaulby: true },
      { feature: "Google Reviews Monitoring", competitor: false, kaulby: true },
      { feature: "AI Sentiment Analysis", competitor: "Premium only", kaulby: true },
      { feature: "Pain Point Detection", competitor: false, kaulby: true },
      { feature: "Boolean Search", competitor: true, kaulby: true },
      { feature: "Slack/Discord Alerts", competitor: "Slack only", kaulby: true },
      { feature: "Free Tier", competitor: false, kaulby: true },
      { feature: "Starting Price", competitor: "$41/mo", kaulby: "$0 (Free tier)" },
    ],
  },
  brand24: {
    name: "Brand24",
    tagline: "Media Monitoring Tool",
    description: "Brand24 tracks online mentions across social media, news, blogs, videos, forums, and reviews.",
    pricing: "Starts at $79/month",
    limitations: [
      "No dedicated Reddit monitoring",
      "Expensive for small teams",
      "Limited AI features",
      "Complex interface",
    ],
    features: [
      { feature: "Reddit Monitoring", competitor: "Basic", kaulby: true },
      { feature: "Hacker News Monitoring", competitor: false, kaulby: true },
      { feature: "Product Hunt Monitoring", competitor: false, kaulby: true },
      { feature: "AI Sentiment Analysis", competitor: "Basic", kaulby: true },
      { feature: "Pain Point Detection", competitor: false, kaulby: true },
      { feature: "Conversation Categories", competitor: false, kaulby: true },
      { feature: "Boolean Search", competitor: true, kaulby: true },
      { feature: "Email Digests", competitor: true, kaulby: true },
      { feature: "Free Tier", competitor: false, kaulby: true },
      { feature: "Starting Price", competitor: "$79/mo", kaulby: "$0 (Free tier)" },
    ],
  },
  brandwatch: {
    name: "Brandwatch",
    tagline: "Enterprise Social Intelligence",
    description: "Brandwatch is an enterprise social intelligence platform for large brands and agencies.",
    pricing: "Custom pricing (typically $1000+/month)",
    limitations: [
      "Enterprise-only pricing",
      "Complex setup",
      "Overkill for startups",
      "Long sales cycle",
    ],
    features: [
      { feature: "Reddit Monitoring", competitor: true, kaulby: true },
      { feature: "Hacker News Monitoring", competitor: false, kaulby: true },
      { feature: "Product Hunt Monitoring", competitor: false, kaulby: true },
      { feature: "AI Sentiment Analysis", competitor: true, kaulby: true },
      { feature: "Pain Point Detection", competitor: false, kaulby: true },
      { feature: "Self-Serve Signup", competitor: false, kaulby: true },
      { feature: "Free Tier", competitor: false, kaulby: true },
      { feature: "Startup-Friendly Pricing", competitor: false, kaulby: true },
      { feature: "Quick Setup", competitor: false, kaulby: true },
      { feature: "Starting Price", competitor: "$1000+/mo", kaulby: "$0 (Free tier)" },
    ],
  },
  hootsuite: {
    name: "Hootsuite",
    tagline: "Social Media Management",
    description: "Hootsuite is primarily a social media management tool with some monitoring capabilities.",
    pricing: "Starts at $99/month",
    limitations: [
      "Focused on social posting, not monitoring",
      "Limited Reddit support",
      "No community-specific monitoring",
      "Basic sentiment analysis",
    ],
    features: [
      { feature: "Reddit Monitoring", competitor: "Very limited", kaulby: true },
      { feature: "Hacker News Monitoring", competitor: false, kaulby: true },
      { feature: "Product Hunt Monitoring", competitor: false, kaulby: true },
      { feature: "AI Sentiment Analysis", competitor: "Basic", kaulby: true },
      { feature: "Pain Point Detection", competitor: false, kaulby: true },
      { feature: "Social Posting", competitor: true, kaulby: false },
      { feature: "Community Focus", competitor: false, kaulby: true },
      { feature: "Free Tier", competitor: false, kaulby: true },
      { feature: "Starting Price", competitor: "$99/mo", kaulby: "$0 (Free tier)" },
    ],
  },
  sproutsocial: {
    name: "Sprout Social",
    tagline: "Social Media Management",
    description: "Sprout Social is an enterprise social media management platform with monitoring features.",
    pricing: "Starts at $249/month",
    limitations: [
      "Very expensive",
      "Enterprise-focused",
      "Limited Reddit monitoring",
      "No community platforms",
    ],
    features: [
      { feature: "Reddit Monitoring", competitor: "Limited", kaulby: true },
      { feature: "Hacker News Monitoring", competitor: false, kaulby: true },
      { feature: "Product Hunt Monitoring", competitor: false, kaulby: true },
      { feature: "AI Sentiment Analysis", competitor: true, kaulby: true },
      { feature: "Pain Point Detection", competitor: false, kaulby: true },
      { feature: "Developer Communities", competitor: false, kaulby: true },
      { feature: "Free Tier", competitor: false, kaulby: true },
      { feature: "Startup-Friendly", competitor: false, kaulby: true },
      { feature: "Starting Price", competitor: "$249/mo", kaulby: "$0 (Free tier)" },
    ],
  },
  awario: {
    name: "Awario",
    tagline: "Social Listening Tool",
    description: "Awario is a social listening and analytics tool for brand monitoring across the web.",
    pricing: "Starts at $29/month",
    limitations: [
      "Limited Reddit coverage",
      "No developer platform monitoring",
      "Basic AI features",
      "Limited integrations",
    ],
    features: [
      { feature: "Reddit Monitoring", competitor: "Basic", kaulby: true },
      { feature: "Hacker News Monitoring", competitor: false, kaulby: true },
      { feature: "Product Hunt Monitoring", competitor: false, kaulby: true },
      { feature: "Google Reviews", competitor: false, kaulby: true },
      { feature: "AI Sentiment Analysis", competitor: "Basic", kaulby: true },
      { feature: "Pain Point Detection", competitor: false, kaulby: true },
      { feature: "Boolean Search", competitor: true, kaulby: true },
      { feature: "Slack/Discord Alerts", competitor: "Slack only", kaulby: true },
      { feature: "Free Tier", competitor: false, kaulby: true },
      { feature: "Starting Price", competitor: "$29/mo", kaulby: "$0 (Free tier)" },
    ],
  },
};

const kaulbyAdvantages = [
  {
    title: "9 Platforms in One",
    description: "Monitor Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot, App Store, Play Store, Quora, and Dev.to - all from one dashboard.",
  },
  {
    title: "AI-Powered Insights",
    description: "Automatic sentiment analysis, pain point detection, and conversation categorization on every mention.",
  },
  {
    title: "Free Forever Tier",
    description: "Start monitoring for free with no credit card required. Upgrade only when you need more.",
  },
  {
    title: "Built for Communities",
    description: "Purpose-built for monitoring developer and startup communities where your customers are.",
  },
];

export default function AlternativePage() {
  const params = useParams();
  const slug = params.competitor as string;

  const competitor = competitorData[slug] || {
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    tagline: "Monitoring Tool",
    description: `Compare ${slug} with Kaulby for community monitoring.`,
    pricing: "Varies",
    limitations: ["Limited community coverage", "No free tier"],
    features: [
      { feature: "Reddit Monitoring", competitor: "Limited", kaulby: true },
      { feature: "9 Platform Coverage", competitor: false, kaulby: true },
      { feature: "AI Sentiment Analysis", competitor: "Varies", kaulby: true },
      { feature: "Pain Point Detection", competitor: false, kaulby: true },
      { feature: "Free Tier", competitor: false, kaulby: true },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">K</span>
            </div>
            <span className="font-semibold text-lg">Kaulby</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
            <Link href={`/sign-up?ref=vs-${slug}`}>
              <Button>Try Kaulby Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            {competitor.name} Alternative
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Kaulby vs {competitor.name}
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            Looking for a {competitor.name} alternative? Kaulby offers better community coverage, AI-powered insights, and a free tier.
          </p>
          <p className="text-lg text-muted-foreground mb-8">
            {competitor.tagline} - {competitor.pricing}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=vs-${slug}`}>
              <Button size="lg" className="gap-2 text-lg px-8">
                Try Kaulby Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section className="py-12 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-center mb-6">Common {competitor.name} Limitations</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {competitor.limitations.map((limitation) => (
              <Badge key={limitation} variant="outline" className="text-base px-4 py-2 border-destructive/50 text-destructive">
                {limitation}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">Feature Comparison</h2>
          <p className="text-muted-foreground text-center mb-12">
            See how Kaulby compares to {competitor.name} feature by feature.
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Feature</TableHead>
                    <TableHead className="text-center">{competitor.name}</TableHead>
                    <TableHead className="text-center bg-primary/5">Kaulby</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitor.features.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="font-medium">{row.feature}</TableCell>
                      <TableCell className="text-center">
                        {typeof row.competitor === "boolean" ? (
                          row.competitor ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.competitor}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center bg-primary/5">
                        {typeof row.kaulby === "boolean" ? (
                          row.kaulby ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm font-medium text-primary">{row.kaulby}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why Kaulby */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">Why Choose Kaulby</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Purpose-built for monitoring the communities where your customers actually hang out.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kaulbyAdvantages.map((advantage) => (
              <Card key={advantage.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{advantage.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{advantage.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Switch from {competitor.name}?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Try Kaulby free and see the difference. No credit card required.
          </p>
          <Link href={`/sign-up?ref=vs-${slug}`}>
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Other Alternatives */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">Compare Other Alternatives</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {Object.entries(competitorData)
              .filter(([key]) => key !== slug)
              .map(([key, data]) => (
                <Link key={key} href={`/alternatives/${key}`}>
                  <Badge variant="outline" className="text-base px-4 py-2 cursor-pointer hover:bg-muted">
                    vs {data.name}
                  </Badge>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">K</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Kaulby - Community Intelligence Platform
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
