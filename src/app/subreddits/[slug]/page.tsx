"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";

// Popular subreddits with metadata for SEO pages
const subredditData: Record<string, {
  name: string;
  description: string;
  topics: string[];
  useCase: string;
  memberCount: string;
}> = {
  startups: {
    name: "r/startups",
    description: "The largest startup community on Reddit with founders sharing advice, asking for feedback, and discussing their journey.",
    topics: ["Startup advice", "Product feedback", "Founder experiences", "Fundraising"],
    useCase: "Track competitor mentions, find product feedback opportunities, and identify potential customers asking for solutions.",
    memberCount: "1.2M+",
  },
  saas: {
    name: "r/SaaS",
    description: "Community for SaaS founders and professionals discussing software-as-a-service businesses, growth strategies, and tools.",
    topics: ["SaaS growth", "Pricing strategies", "Churn reduction", "B2B sales"],
    useCase: "Monitor discussions about your product category, find users looking for alternatives to competitors, and gather market intelligence.",
    memberCount: "150K+",
  },
  entrepreneur: {
    name: "r/Entrepreneur",
    description: "One of the most active entrepreneurship communities with discussions on business ideas, marketing, and growth.",
    topics: ["Business ideas", "Marketing", "Sales", "Side projects"],
    useCase: "Identify potential customers discussing problems your product solves, track brand mentions, and find content marketing opportunities.",
    memberCount: "2.5M+",
  },
  smallbusiness: {
    name: "r/smallbusiness",
    description: "Community for small business owners discussing operations, growth challenges, and sharing experiences.",
    topics: ["Operations", "Hiring", "Local marketing", "Finance"],
    useCase: "Find small business owners looking for tools and solutions, track competitor discussions, and gather customer insights.",
    memberCount: "800K+",
  },
  webdev: {
    name: "r/webdev",
    description: "Web development community discussing frameworks, tools, best practices, and career advice.",
    topics: ["Frontend", "Backend", "DevOps", "Career"],
    useCase: "Monitor discussions about developer tools, find users experiencing pain points your product addresses, and track technology trends.",
    memberCount: "1.8M+",
  },
  programming: {
    name: "r/programming",
    description: "General programming community with discussions on languages, tools, industry news, and best practices.",
    topics: ["Languages", "Tools", "Best practices", "Industry news"],
    useCase: "Track mentions of your developer tool, find users looking for alternatives, and identify emerging pain points in the dev community.",
    memberCount: "5.5M+",
  },
  marketing: {
    name: "r/marketing",
    description: "Marketing professionals sharing strategies, discussing tools, and asking for advice.",
    topics: ["Digital marketing", "Content", "SEO", "Paid ads"],
    useCase: "Monitor discussions about marketing tools, find users looking for solutions, and track competitor mentions.",
    memberCount: "600K+",
  },
  socialmedia: {
    name: "r/socialmedia",
    description: "Community focused on social media marketing, platforms, and growth strategies.",
    topics: ["Platform updates", "Growth tactics", "Content strategy", "Analytics"],
    useCase: "Track discussions about social media tools, find users with pain points, and monitor industry trends.",
    memberCount: "300K+",
  },
  productivity: {
    name: "r/productivity",
    description: "Community dedicated to productivity tools, methods, and personal efficiency.",
    topics: ["Tools", "Methods", "Time management", "Habits"],
    useCase: "Find users looking for productivity solutions, track competitor mentions, and identify feature request opportunities.",
    memberCount: "2M+",
  },
  sideproject: {
    name: "r/SideProject",
    description: "Makers and indie hackers sharing their side projects and gathering feedback.",
    topics: ["Indie hacking", "Project showcases", "Feedback", "Launch strategies"],
    useCase: "Monitor your product niche, find early adopters, and identify users actively building in your space.",
    memberCount: "200K+",
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

export default function SubredditPage() {
  const params = useParams();
  const slug = params.slug as string;

  const subreddit = subredditData[slug] || {
    name: `r/${slug}`,
    description: `Monitor discussions, mentions, and conversations in r/${slug} with Kaulby's AI-powered community monitoring.`,
    topics: ["Discussions", "Mentions", "Questions", "Feedback"],
    useCase: "Track brand mentions, find potential customers, and gather market intelligence from this community.",
    memberCount: "Active",
  };

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
            Monitor <span className="text-primary">{subreddit.name}</span>
            <br />
            with AI-Powered Insights
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            {subreddit.description}
          </p>
          <p className="text-lg text-muted-foreground mb-8">
            <span className="font-semibold">{subreddit.memberCount}</span> members
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=subreddit-${slug}`}>
              <Button size="lg" className="gap-2 text-lg px-8">
                Start Monitoring {subreddit.name}
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
          <h2 className="text-xl font-semibold text-center mb-6">Popular Topics in {subreddit.name}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {subreddit.topics.map((topic) => (
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
              <CardTitle className="text-2xl">Why Monitor {subreddit.name}?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-muted-foreground">{subreddit.useCase}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">How Kaulby Monitors {subreddit.name}</h2>
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
                Add {subreddit.name} and set your keywords - brand name, competitors, or topics.
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
            Start Monitoring {subreddit.name} Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join thousands of businesses using Kaulby to track Reddit conversations and find customers.
          </p>
          <Link href={`/sign-up?ref=subreddit-${slug}`}>
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
            {Object.entries(subredditData)
              .filter(([key]) => key !== slug)
              .slice(0, 6)
              .map(([key, data]) => (
                <Link key={key} href={`/subreddits/${key}`}>
                  <Badge variant="outline" className="text-base px-4 py-2 cursor-pointer hover:bg-muted">
                    {data.name}
                  </Badge>
                </Link>
              ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
