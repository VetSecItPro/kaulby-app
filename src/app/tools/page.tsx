import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MessageSquare, Building2, Users, Search } from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { WebPageSchema, FAQSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Social Listening Tools for Startups | Kaulby",
  description: "Discover Kaulby's suite of AI-powered social listening tools. Reddit monitoring, brand monitoring, competitor tracking, and more across 9 platforms.",
  openGraph: {
    title: "Social Listening Tools for Startups",
    description: "AI-powered social listening tools for monitoring Reddit, Hacker News, Product Hunt, and 6 more platforms.",
    url: "https://kaulbyapp.com/tools",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/tools",
  },
};

const tools = [
  {
    slug: "reddit-monitoring",
    name: "Reddit Monitoring",
    description: "Track brand mentions, competitor discussions, and customer pain points across Reddit subreddits with AI-powered analysis.",
    icon: MessageSquare,
    features: ["Subreddit filtering", "AI sentiment analysis", "Pain point detection", "Real-time alerts"],
  },
  {
    slug: "brand-monitoring",
    name: "Brand Monitoring",
    description: "Monitor your brand across 9 platforms. Get instant alerts when customers mention you on Reddit, HN, reviews, and more.",
    icon: Building2,
    features: ["9 platform coverage", "Sentiment tracking", "Share of voice", "Team collaboration"],
  },
  {
    slug: "competitor-monitoring",
    name: "Competitor Monitoring",
    description: "Track what customers say about competitors. Find unhappy users, feature requests, and market opportunities.",
    icon: Users,
    features: ["Competitor tracking", "Opportunity detection", "Feature gap analysis", "Lead identification"],
  },
  {
    slug: "social-listening-for-startups",
    name: "Social Listening for Startups",
    description: "Affordable social listening built for startups. Monitor communities where your customers discuss products and find leads.",
    icon: Search,
    features: ["Free tier available", "Startup-friendly pricing", "Community focus", "AI-powered insights"],
  },
];

const platforms = [
  "Reddit",
  "Hacker News",
  "Product Hunt",
  "Google Reviews",
  "Trustpilot",
  "App Store",
  "Play Store",
  "Quora",
  "Dev.to",
];

const faqs = [
  {
    question: "What is social listening?",
    answer: "Social listening is the practice of monitoring online conversations about your brand, competitors, and industry. It helps you understand customer sentiment, find leads, identify product feedback, and stay ahead of market trends.",
  },
  {
    question: "What platforms does Kaulby monitor?",
    answer: "Kaulby monitors 9 platforms: Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot, App Store reviews, Play Store reviews, Quora, and Dev.to. These are the communities where startup customers actively discuss products.",
  },
  {
    question: "How is Kaulby different from other social listening tools?",
    answer: "Kaulby focuses on community platforms where real product discussions happen, not just Twitter mentions. It includes AI-powered pain point detection, conversation categorization (Solution Requests, Money Talk, etc.), and a free tier for startups.",
  },
  {
    question: "Can I use Kaulby for free?",
    answer: "Yes, Kaulby offers a free forever tier with 1 Reddit monitor, AI sentiment analysis, and dashboard access. No credit card required. Upgrade to Pro ($29/mo) for more monitors and platform coverage.",
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data */}
      <WebPageSchema
        title="Social Listening Tools for Startups"
        description="Discover Kaulby's suite of AI-powered social listening tools for monitoring communities."
        url="https://kaulbyapp.com/tools"
        breadcrumbs={[
          { name: "Home", url: "https://kaulbyapp.com" },
          { name: "Tools", url: "https://kaulbyapp.com/tools" },
        ]}
      />
      <FAQSchema faqs={faqs} />

      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">Social Listening Tools</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            AI-Powered Community Monitoring
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Monitor brand mentions, track competitors, and find customers across the communities
            where people actually discuss products.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="py-12 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-center mb-6">Monitor 9 Platforms</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {platforms.map((platform) => (
              <Badge key={platform} variant="outline" className="text-sm px-4 py-2">
                {platform}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">Our Tools</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Choose the right monitoring approach for your needs. All tools include AI-powered analysis.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                  <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle>{tool.name}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {tool.features.map((feature) => (
                          <Badge key={feature} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-sm text-primary font-medium flex items-center gap-1">
                        Learn more <ArrowRight className="h-3 w-3" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-background rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-muted-foreground text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Monitoring Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Free tier available. No credit card required.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
