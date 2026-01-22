import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check } from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { WebPageSchema, FAQSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Kaulby Alternatives - Compare Social Listening Tools | Kaulby",
  description: "Compare Kaulby to popular social listening tools like GummySearch, Brand24, Mention, Hootsuite, and more. See why startups choose Kaulby for community monitoring.",
  openGraph: {
    title: "Kaulby Alternatives - Compare Social Listening Tools",
    description: "Compare Kaulby to popular social listening tools. 9 platforms, AI-powered insights, free tier available.",
    url: "https://kaulbyapp.com/alternatives",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/alternatives",
  },
};

const alternatives = [
  {
    slug: "gummysearch",
    name: "GummySearch",
    tagline: "Reddit Audience Research (Shutting Down)",
    description: "GummySearch was Reddit-only. Kaulby monitors 9 platforms with the same AI features.",
    status: "Shutting Down",
    pricing: "Was $29-59/mo",
    highlight: true,
  },
  {
    slug: "brand24",
    name: "Brand24",
    tagline: "Media Monitoring Tool",
    description: "Brand24 starts at $79/mo. Kaulby offers similar features at $29/mo with a free tier.",
    pricing: "$79+/mo",
  },
  {
    slug: "mention",
    name: "Mention",
    tagline: "Social Listening Tool",
    description: "Mention has limited Reddit coverage. Kaulby specializes in community monitoring.",
    pricing: "$41+/mo",
  },
  {
    slug: "brandwatch",
    name: "Brandwatch",
    tagline: "Enterprise Social Intelligence",
    description: "Brandwatch is enterprise-only at $1000+/mo. Kaulby offers startup-friendly pricing.",
    pricing: "$1000+/mo",
  },
  {
    slug: "hootsuite",
    name: "Hootsuite",
    tagline: "Social Media Management",
    description: "Hootsuite focuses on posting, not monitoring. Kaulby specializes in community listening.",
    pricing: "$99+/mo",
  },
  {
    slug: "sproutsocial",
    name: "Sprout Social",
    tagline: "Social Media Management",
    description: "Sprout Social costs $249+/user/mo. Kaulby Team is $79/mo for up to 5 users.",
    pricing: "$249+/user/mo",
  },
  {
    slug: "awario",
    name: "Awario",
    tagline: "Social Listening Tool",
    description: "Awario monitors broad social media. Kaulby specializes in developer communities.",
    pricing: "$29+/mo",
  },
  {
    slug: "syften",
    name: "Syften",
    tagline: "Keyword Monitoring Tool",
    description: "Syften lacks AI features. Kaulby includes sentiment analysis and pain point detection.",
    pricing: "$19.95+/mo",
  },
  {
    slug: "redreach",
    name: "RedReach",
    tagline: "Reddit Marketing Tool",
    description: "RedReach is Reddit-only. Kaulby monitors 9 platforms including review sites.",
    pricing: "$19+/mo",
  },
  {
    slug: "subredditsignals",
    name: "Subreddit Signals",
    tagline: "Reddit Lead Generation",
    description: "Subreddit Signals focuses on Reddit sales. Kaulby offers broader multi-platform monitoring.",
    pricing: "$19.99+/mo",
  },
  {
    slug: "f5bot",
    name: "F5Bot",
    tagline: "Free Reddit Alerts",
    description: "F5Bot is free but basic (email only). Kaulby free tier includes dashboard and AI.",
    pricing: "Free",
  },
];

const faqs = [
  {
    question: "What is the best social listening tool for startups?",
    answer: "Kaulby is purpose-built for startups with a free tier, affordable Pro plan at $29/mo, and focus on communities where startup customers discuss products (Reddit, Hacker News, Product Hunt). Enterprise tools like Brandwatch and Sprout Social are overkill for most startups.",
  },
  {
    question: "What is the best GummySearch alternative?",
    answer: "Kaulby is the best GummySearch alternative. It offers the same Reddit monitoring with AI analysis, plus 8 more platforms (Hacker News, Product Hunt, review sites). Unlike GummySearch, Kaulby isn't dependent on a single platform's API.",
  },
  {
    question: "How does Kaulby compare to Brand24 and Mention?",
    answer: "Kaulby focuses on community platforms (Reddit, HN, reviews) while Brand24 and Mention focus on traditional social media. Kaulby is more affordable ($0-79/mo vs $41-999/mo) and includes AI pain point detection that competitors lack.",
  },
  {
    question: "Is there a free social listening tool?",
    answer: "Kaulby offers a free forever tier with 1 Reddit monitor, AI sentiment analysis, and dashboard access. F5Bot is also free but only provides basic email alerts without a dashboard or AI features.",
  },
];

const kaulbyAdvantages = [
  "9 platforms (Reddit, HN, Product Hunt, reviews, and more)",
  "AI sentiment analysis on all tiers",
  "Pain point detection and conversation categorization",
  "Free forever tier available",
  "Team collaboration features",
  "Startup-friendly pricing",
];

export default function AlternativesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data */}
      <WebPageSchema
        title="Kaulby Alternatives - Compare Social Listening Tools"
        description="Compare Kaulby to popular social listening tools like GummySearch, Brand24, Mention, and more."
        url="https://kaulbyapp.com/alternatives"
        breadcrumbs={[
          { name: "Home", url: "https://kaulbyapp.com" },
          { name: "Alternatives", url: "https://kaulbyapp.com/alternatives" },
        ]}
      />
      <FAQSchema faqs={faqs} />

      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4">Compare Tools</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Kaulby vs Other Social Listening Tools
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            See how Kaulby compares to popular alternatives. Purpose-built for monitoring
            communities where your customers actually discuss products.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Try Kaulby Free
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

      {/* Why Kaulby */}
      <section className="py-12 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-center mb-6">Why Teams Choose Kaulby</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {kaulbyAdvantages.map((advantage) => (
              <Badge key={advantage} variant="outline" className="text-sm px-4 py-2 gap-2">
                <Check className="h-3 w-3 text-green-500" />
                {advantage}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Alternatives Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">Compare Alternatives</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Click any tool to see a detailed feature comparison with Kaulby.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {alternatives.map((alt) => (
              <Link key={alt.slug} href={`/alternatives/${alt.slug}`}>
                <Card className={`h-full hover:border-primary/50 transition-colors cursor-pointer ${alt.highlight ? "border-primary/30 bg-primary/5" : ""}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{alt.name}</CardTitle>
                        <CardDescription className="text-xs">{alt.tagline}</CardDescription>
                      </div>
                      {alt.status && (
                        <Badge variant="destructive" className="text-xs">{alt.status}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{alt.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{alt.pricing}</span>
                      <span className="text-sm text-primary font-medium flex items-center gap-1">
                        Compare <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
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
            Ready to Try Kaulby?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Start free and see why startups choose Kaulby for community monitoring.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
