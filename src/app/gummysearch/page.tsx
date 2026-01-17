"use client";

import Link from "next/link";
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
import {
  Check,
  X,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Brain,
  Download,
  Clock,
  Sparkles,
} from "lucide-react";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";

// Feature comparison data
const featureComparison = [
  { feature: "Reddit Monitoring", gummysearch: true, kaulby: true },
  { feature: "Hacker News Monitoring", gummysearch: false, kaulby: true },
  { feature: "Product Hunt Monitoring", gummysearch: false, kaulby: true },
  { feature: "Google Reviews Monitoring", gummysearch: false, kaulby: true },
  { feature: "Trustpilot Monitoring", gummysearch: false, kaulby: true },
  { feature: "App Store/Play Store Reviews", gummysearch: false, kaulby: true },
  { feature: "Quora Monitoring", gummysearch: false, kaulby: true },
  { feature: "Dev.to Monitoring", gummysearch: false, kaulby: true },
  { feature: "AI Sentiment Analysis", gummysearch: true, kaulby: true },
  { feature: "Pain Point Detection", gummysearch: true, kaulby: true },
  { feature: "Conversation Categories", gummysearch: true, kaulby: true },
  { feature: "Boolean Search Operators", gummysearch: true, kaulby: true },
  { feature: "Email Digests", gummysearch: true, kaulby: true },
  { feature: "Slack/Discord Alerts", gummysearch: true, kaulby: true },
  { feature: "Data Export (CSV/JSON)", gummysearch: true, kaulby: true },
  { feature: "Audience Grouping", gummysearch: true, kaulby: true },
  { feature: "Team Collaboration", gummysearch: "Enterprise", kaulby: "Team Plan" },
  { feature: "API Access", gummysearch: "Enterprise", kaulby: "Coming Soon" },
  { feature: "Active Development", gummysearch: false, kaulby: true },
];

const benefits = [
  {
    icon: Globe,
    title: "9 Platforms, Not Just 1",
    description: "Monitor Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot, App Store, Play Store, Quora, and Dev.to - all in one place.",
  },
  {
    icon: Brain,
    title: "Same AI, More Power",
    description: "All the AI features you loved - sentiment analysis, pain point detection, conversation categorization - now across all platforms.",
  },
  {
    icon: Shield,
    title: "Built to Last",
    description: "Multiple data sources, circuit breaker patterns, and fallback systems. We're designed to survive platform changes.",
  },
  {
    icon: Zap,
    title: "Actively Developed",
    description: "New features every week. We're committed to building the best community monitoring tool available.",
  },
];

export default function GummySearchPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            <Sparkles className="h-3 w-3 mr-1" />
            For GummySearch Users
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            GummySearch is Closing.
            <br />
            <span className="text-primary">Kaulby is Here.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Everything you loved about GummySearch - plus 8 more platforms, better AI, and a team committed to keeping it running.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up?ref=gummysearch">
              <Button size="lg" className="gap-2 text-lg px-8">
                Start Free Migration
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Free forever tier available. No credit card required.
          </p>
        </div>
      </section>

      {/* Special Offer Banner */}
      <section className="py-8 bg-primary/5 border-y">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left">
            <div className="flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">GummySearch Migration Offer:</span>
            </div>
            <p className="text-muted-foreground">
              Sign up with code <code className="bg-primary/10 px-2 py-1 rounded font-mono font-semibold text-primary">GUMMY30</code> for 30% off your first 3 months of Pro or Team.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">Why Kaulby?</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            We built Kaulby for users like you - people who need reliable community monitoring that won&apos;t disappear overnight.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{benefit.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">Feature Comparison</h2>
          <p className="text-muted-foreground text-center mb-12">
            See how Kaulby compares to GummySearch feature by feature.
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Feature</TableHead>
                    <TableHead className="text-center">GummySearch</TableHead>
                    <TableHead className="text-center bg-primary/5">Kaulby</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureComparison.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="font-medium">{row.feature}</TableCell>
                      <TableCell className="text-center">
                        {typeof row.gummysearch === "boolean" ? (
                          row.gummysearch ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.gummysearch}</span>
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
                          <span className="text-sm text-muted-foreground">{row.kaulby}</span>
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

      {/* Migration Steps */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">Easy Migration in 3 Steps</h2>
          <p className="text-muted-foreground text-center mb-12">
            Get up and running in minutes, not hours.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Sign Up Free</h3>
              <p className="text-muted-foreground">
                Create your Kaulby account in 30 seconds. No credit card required.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Recreate Monitors</h3>
              <p className="text-muted-foreground">
                Set up your keywords and subreddits. Our wizard makes it easy.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Start Monitoring</h3>
              <p className="text-muted-foreground">
                Results start flowing immediately. Get alerts on Slack, Discord, or email.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Export CTA */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-8 text-center">
              <Download className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Export Your GummySearch Data</h3>
              <p className="text-muted-foreground mb-6">
                Before GummySearch shuts down, export your monitors and historical data. Then you can use our setup wizard to recreate your monitoring configuration in Kaulby.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/sign-up?ref=gummysearch">
                  <Button size="lg" className="gap-2">
                    Get Started with Kaulby
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Don&apos;t Let Your Monitoring Stop
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join hundreds of former GummySearch users who made the switch. Start your free migration today.
          </p>
          <Link href="/sign-up?ref=gummysearch">
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Start Free Migration
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <p className="text-sm opacity-75 mt-4">
            Use code <span className="font-semibold">GUMMY30</span> for 30% off Pro or Team
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
