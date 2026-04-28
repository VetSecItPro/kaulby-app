import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Switch from GummySearch to Kaulby - Migration Guide",
  description:
    "GummySearch only monitors Reddit. Kaulby monitors 16 platforms with AI-powered pain point detection, lead scoring, and competitor intelligence. Here's how to switch.",
  openGraph: {
    title: "Switch from GummySearch to Kaulby",
    description:
      "Monitor 16 platforms instead of just Reddit. AI pain points, lead scoring, and competitor intelligence included.",
  },
};

const comparisonRows = [
  {
    feature: "Platforms Monitored",
    gummysearch: "Reddit only",
    kaulby: "16 platforms (Reddit, HN, Google Reviews, Trustpilot, YouTube, X, G2, and more)",
    kaulbyWins: true,
  },
  {
    feature: "AI Pain Point Detection",
    gummysearch: "Basic keyword themes",
    kaulby: "7-category AI classification with severity ranking and recommendations",
    kaulbyWins: true,
  },
  {
    feature: "Lead / Buying Signal Scoring",
    gummysearch: "No",
    kaulby: "0-100 composite lead score with intent, engagement, and recency factors",
    kaulbyWins: true,
  },
  {
    feature: "Competitor Intelligence",
    gummysearch: "Reddit mentions only",
    kaulby: "Cross-platform competitor tracking with complaint clustering",
    kaulbyWins: true,
  },
  {
    feature: "Sentiment Analysis",
    gummysearch: "Basic positive/negative",
    kaulby: "Nuanced sentiment with sarcasm detection, confidence scoring, and emotion classification",
    kaulbyWins: true,
  },
  {
    feature: "Email Digests",
    gummysearch: "Yes",
    kaulby: "Daily, weekly, monthly digests with AI-generated executive summaries",
    kaulbyWins: true,
  },
  {
    feature: "Entry pricing (paid)",
    gummysearch: "$29/mo",
    kaulby: "$39/mo (Solo) — 9 platforms, unlimited keywords, AI Q&A",
    kaulbyWins: true,
  },
  {
    feature: "API Access",
    gummysearch: "No",
    kaulby: "Full REST API with key management",
    kaulbyWins: true,
  },
  {
    feature: "Team Workspaces",
    gummysearch: "No",
    kaulby: "Role-based team access with shared monitors",
    kaulbyWins: true,
  },
  {
    feature: "Reddit Depth",
    gummysearch: "Strong - subreddit search, hot posts, audience insights",
    kaulby: "Good - keyword monitoring, subreddit tracking, AI analysis",
    kaulbyWins: false,
  },
];

const migrationSteps = [
  {
    step: 1,
    title: "Note your GummySearch keywords",
    description:
      "Open GummySearch and write down the keywords and subreddits you're currently monitoring. You'll add these to Kaulby in step 3.",
  },
  {
    step: 2,
    title: "Create your Kaulby account",
    description:
      "Sign up for free at kaulbyapp.com. No credit card required. The onboarding wizard will guide you through setup.",
  },
  {
    step: 3,
    title: "Set up your monitors",
    description:
      "Create monitors with the same keywords. Select Reddit + any additional platforms you want to track. Kaulby starts scanning immediately.",
  },
  {
    step: 4,
    title: "Explore cross-platform insights",
    description:
      "Within 2-4 hours, you'll have results from multiple platforms. Check the Pain Points tab and Recommendations tab for AI-powered analysis you didn't have before.",
  },
];

export default function GummySearchMigrationPage() {
  return (
    <div className="py-16 md:py-24 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">
            Migration Guide
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Switch from GummySearch to{" "}
            <span className="gradient-text">Kaulby</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Love Reddit research but need more platforms, AI-powered pain point detection,
            and lead scoring? Kaulby gives you everything GummySearch does - plus 16 more platforms
            and deeper AI analysis - at the same price.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Try Day Pass - $15/24h <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                Compare Plans
              </Button>
            </Link>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            Feature Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    Feature
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                    GummySearch
                  </th>
                  <th className="text-left p-4 text-sm font-medium">
                    <span className="gradient-text font-bold">Kaulby</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4 text-sm font-medium">{row.feature}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {row.gummysearch}
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex items-start gap-2">
                        {row.kaulbyWins ? (
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <span>{row.kaulby}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Why Switch */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            Why teams switch from GummySearch
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reddit is not enough</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Your customers discuss products on Google Reviews, Trustpilot, G2,
                Hacker News, YouTube, and X. GummySearch only sees Reddit.
                Kaulby sees all 16.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  AI that goes beyond themes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                GummySearch groups Reddit posts by topic. Kaulby classifies every
                mention into pain point categories, scores buying intent, detects
                sarcasm, and generates prioritized recommendations.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Same price, more value</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                GummySearch was $29/mo for Pro. Kaulby Solo is $39/mo and includes 9 platforms,
                lead scoring, team workspaces, API access, scheduled reports, and
                webhook integrations - all included.
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Migration Steps */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">
            How to switch in 5 minutes
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {migrationSteps.map((step) => (
              <Card key={step.step}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center text-lg font-bold text-white shrink-0">
                      {step.step}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center py-12 px-6 rounded-2xl gradient-primary">
          <h2 className="text-2xl font-bold text-white mb-3">
            Ready to see more than just Reddit?
          </h2>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            Set up your first monitor in 30 seconds. Start free, upgrade when you
            need more platforms and AI depth.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2">
              Start Monitoring <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How is Kaulby different from GummySearch?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "GummySearch monitors Reddit only. Kaulby monitors 16 platforms including Reddit, Hacker News, Google Reviews, Trustpilot, G2, YouTube, and more. Kaulby also includes AI pain point detection, lead scoring, and team workspaces.",
                },
              },
              {
                "@type": "Question",
                name: "Is Kaulby more expensive than GummySearch?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Kaulby's entry paid tier (Solo) is $39/month vs GummySearch's $29/month — but Kaulby includes 9 platforms (vs Reddit-only), deeper AI analysis, and unlimited keywords. The Scale tier ($79) adds review platforms; Growth ($149) adds team workspaces and the public API.",
                },
              },
              {
                "@type": "Question",
                name: "Can I import my GummySearch data to Kaulby?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "There's no direct import, but migration takes about 5 minutes. Simply note your keywords and subreddits from GummySearch and create the same monitors in Kaulby. Results start appearing within 2-4 hours.",
                },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
