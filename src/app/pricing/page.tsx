"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, X } from "lucide-react";
import { CheckoutModal } from "@/components/checkout-modal";
import { cn } from "@/lib/utils";
import type { BillingInterval } from "@/lib/plans";

interface Feature {
  text: string;
  comingSoon?: boolean;
}

interface Plan {
  name: string;
  key: "free" | "pro" | "enterprise";
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: Feature[];
  cta: string;
  href: string;
  popular: boolean;
  trialDays: number;
}

const plans: Plan[] = [
  {
    name: "Free",
    key: "free",
    description: "Get started with basic monitoring",
    monthlyPrice: 0,
    annualPrice: 0,
    trialDays: 0,
    features: [
      { text: "1 monitor" },
      { text: "Reddit only" },
      { text: "3 keywords per monitor" },
      { text: "View last 3 results" },
      { text: "3-day history" },
      { text: "Basic AI analysis" },
      { text: "Daily refresh cycle" },
    ],
    cta: "Get Started Free",
    href: "/sign-up",
    popular: false,
  },
  {
    name: "Pro",
    key: "pro",
    description: "For power users and professionals",
    monthlyPrice: 29,
    annualPrice: 290,
    trialDays: 14,
    features: [
      { text: "10 monitors" },
      { text: "All 9 platforms" },
      { text: "20 keywords per monitor" },
      { text: "Unlimited results" },
      { text: "90-day history" },
      { text: "4-hour refresh cycle" },
      { text: "Full AI analysis" },
      { text: "Daily email digests" },
      { text: "CSV export" },
    ],
    cta: "Sign Up for Pro",
    href: "/sign-up?plan=pro",
    popular: true,
  },
  {
    name: "Team",
    key: "enterprise",
    description: "For growing teams and agencies",
    monthlyPrice: 99,
    annualPrice: 990,
    trialDays: 14,
    features: [
      { text: "Everything in Pro" },
      { text: "30 monitors" },
      { text: "35 keywords per monitor" },
      { text: "1-year history" },
      { text: "2-hour refresh cycle" },
      { text: "Comprehensive AI analysis" },
      { text: "Real-time email alerts" },
      { text: "Webhooks" },
      { text: "5 team seats (+$15/user)" },
      { text: "API access" },
    ],
    cta: "Sign Up for Team",
    href: "/sign-up?plan=enterprise",
    popular: false,
  },
];

// Feature comparison table data
const featureComparison = [
  { feature: "Monitors", free: "1", pro: "10", team: "30" },
  { feature: "Keywords per monitor", free: "3", pro: "20", team: "35" },
  { feature: "Platforms", free: "Reddit only", pro: "All 9 platforms", team: "All 9 platforms" },
  { feature: "Results visible", free: "Last 3", pro: "Unlimited", team: "Unlimited" },
  { feature: "History retention", free: "3 days", pro: "90 days", team: "1 year" },
  { feature: "Refresh cycle", free: "24 hours", pro: "4 hours", team: "2 hours" },
  { feature: "AI sentiment analysis", free: true, pro: true, team: true },
  { feature: "AI pain point detection", free: false, pro: true, team: true },
  { feature: "Comprehensive AI analysis", free: false, pro: false, team: true },
  { feature: "Email digests", free: false, pro: "Daily", team: "Real-time" },
  { feature: "Slack/Discord alerts", free: false, pro: true, team: true },
  { feature: "Webhooks", free: false, pro: false, team: true },
  { feature: "CSV export", free: false, pro: true, team: true },
  { feature: "API access", free: false, pro: false, team: true },
  { feature: "Team seats", free: "-", pro: "1", team: "5 (+$15/user)" },
];

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise">("pro");
  const [selectedPlanName, setSelectedPlanName] = useState("Pro");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [dayPassStatus, setDayPassStatus] = useState<{
    active: boolean;
    expiresAt: string | null;
  } | null>(null);
  const [isPurchasingDayPass, setIsPurchasingDayPass] = useState(false);

  // Fetch day pass status for signed-in users
  useEffect(() => {
    if (isSignedIn) {
      fetch("/api/user/day-pass")
        .then((res) => res.json())
        .then((data) => {
          setDayPassStatus({
            active: data.active,
            expiresAt: data.expiresAt,
          });
        })
        .catch(console.error);
    }
  }, [isSignedIn]);

  const handleDayPassPurchase = async () => {
    setIsPurchasingDayPass(true);
    try {
      const response = await fetch("/api/polar/day-pass", {
        method: "POST",
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("Day pass purchase error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsPurchasingDayPass(false);
    }
  };

  const handleUpgrade = (planKey: "pro" | "enterprise", planName: string) => {
    setSelectedPlan(planKey);
    setSelectedPlanName(planName);
    setCheckoutOpen(true);
  };

  const getDisplayPrice = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return "$0";
    if (billingInterval === "annual") {
      const monthlyEquivalent = Math.round(plan.annualPrice / 12);
      return `$${monthlyEquivalent}`;
    }
    return `$${plan.monthlyPrice}`;
  };


  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
              <Image
                src="/logo.jpg"
                alt="Kaulby"
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            </div>
            <span className="text-2xl font-bold gradient-text">Kaulby</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/articles" className="text-sm font-medium">
              Articles
            </Link>
            <Link href="/pricing" className="text-sm font-medium">
              Pricing
            </Link>
            {!isSignedIn ? (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                  <Button>Get Started</Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Pricing Section */}
      <main className="flex-1 py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free and upgrade when you need real-time monitoring and full AI insights.
            </p>
            <p className="text-sm text-primary font-medium mt-4">
              First 1,000 ***s lock in Pro or Team price forever
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-10">
            <div className="inline-flex items-center rounded-full bg-muted p-1 relative">
              <button
                onClick={() => setBillingInterval("monthly")}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-colors",
                  billingInterval === "monthly"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("annual")}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-colors",
                  billingInterval === "annual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Annual
              </button>
              <span className="absolute -top-3 right-0 bg-green-400 text-black font-medium text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                2 months free
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${
                  plan.popular ? "border-primary shadow-lg" : ""
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6 min-h-[72px]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{getDisplayPrice(plan)}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    {plan.monthlyPrice > 0 ? (
                      <p className="text-sm text-muted-foreground mt-1">
                        {billingInterval === "annual"
                          ? `Billed annually ($${plan.annualPrice}/year)`
                          : `Billed monthly`}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Free forever</p>
                    )}
                    {plan.trialDays > 0 && (
                      <p className="text-sm text-primary mt-1">{plan.trialDays}-day free trial</p>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm flex items-center gap-2">
                          {feature.text}
                          {feature.comingSoon && (
                            <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Coming Soon
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {!isSignedIn ? (
                    <Link href={plan.href} className="w-full">
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  ) : (
                    plan.key === "free" ? (
                      <Button className="w-full" variant="outline" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => handleUpgrade(plan.key as "pro" | "enterprise", plan.name)}
                      >
                        {plan.cta}
                      </Button>
                    )
                  )}
                </CardFooter>
              </Card>
            ))}

            {/* Day Pass Card - Inline with pricing */}
            <Card className="relative flex flex-col bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-400 dark:border-amber-600">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 hover:bg-amber-400 text-black font-semibold">
                One-Time
              </Badge>
              <CardHeader>
                <CardTitle className="text-amber-900 dark:text-amber-100">Day Pass</CardTitle>
                <CardDescription>Need Pro just for today?</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6 min-h-[72px]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-amber-700 dark:text-amber-300">$10</span>
                    <span className="text-amber-600 dark:text-amber-400">/24hr</span>
                  </div>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-1">
                    One-time payment
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">No subscription needed</p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">Full Pro features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">All 9 platforms</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">Unlimited results</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">Full AI analysis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">24-hour access</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                {!isSignedIn ? (
                  <Link href="/sign-up" className="w-full">
                    <Button className="w-full bg-amber-400 hover:bg-amber-500 text-black font-semibold">
                      Get Day Pass
                    </Button>
                  </Link>
                ) : (
                  dayPassStatus?.active ? (
                    <Button className="w-full bg-amber-400 hover:bg-amber-500 text-black font-semibold" disabled>
                      Active Until {new Date(dayPassStatus.expiresAt!).toLocaleTimeString()}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-amber-400 hover:bg-amber-500 text-black font-semibold"
                      onClick={handleDayPassPurchase}
                      disabled={isPurchasingDayPass}
                    >
                      {isPurchasingDayPass ? "Processing..." : "Get Day Pass - $10"}
                    </Button>
                  )
                )}
              </CardFooter>
            </Card>
          </div>

          {/* Feature Comparison Table */}
          <div className="mt-20 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Compare Plans
            </h2>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Feature</TableHead>
                    <TableHead className="text-center">Free</TableHead>
                    <TableHead className="text-center bg-primary/5">
                      <div className="flex items-center justify-center gap-1">
                        Pro
                        <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Team</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureComparison.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="font-medium">{row.feature}</TableCell>
                      <TableCell className="text-center">
                        {typeof row.free === "boolean" ? (
                          row.free ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm">{row.free}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center bg-primary/5">
                        {typeof row.pro === "boolean" ? (
                          row.pro ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm">{row.pro}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {typeof row.team === "boolean" ? (
                          row.team ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                          )
                        ) : row.team === "Coming soon" ? (
                          <span className="text-xs text-muted-foreground">{row.team}</span>
                        ) : (
                          <span className="text-sm">{row.team}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="free-plan">
                <AccordionTrigger>Is there really a free plan?</AccordionTrigger>
                <AccordionContent>
                  Yes! The Free plan is free forever. You can monitor 1 keyword on Reddit with basic
                  AI analysis and daily refresh. It&apos;s perfect for trying out Kaulby before upgrading.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="trial">
                <AccordionTrigger>How does the 14-day free trial work?</AccordionTrigger>
                <AccordionContent>
                  Pro and Team plans include a 14-day free trial with full access to all features.
                  You&apos;ll enter payment details at checkout, but you won&apos;t be charged until the trial ends.
                  Cancel anytime during the trial and you won&apos;t be billed.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cancel">
                <AccordionTrigger>Can I cancel anytime?</AccordionTrigger>
                <AccordionContent>
                  Yes, you can cancel your subscription at any time from your account settings.
                  You&apos;ll continue to have access to your plan until the end of your current billing period.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="switch-plans">
                <AccordionTrigger>Can I switch between plans?</AccordionTrigger>
                <AccordionContent>
                  Absolutely! You can upgrade or downgrade your plan at any time. When upgrading,
                  you&apos;ll be charged the prorated difference. When downgrading, the change takes effect
                  at your next billing cycle.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="annual">
                <AccordionTrigger>How does annual billing work?</AccordionTrigger>
                <AccordionContent>
                  Annual billing saves you 2 months compared to monthly billing. You pay once per year
                  at a discounted rate: $290/year for Pro ($24/mo equivalent) or $990/year for Team ($82/mo equivalent).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="platforms">
                <AccordionTrigger>What platforms do you monitor?</AccordionTrigger>
                <AccordionContent>
                  We monitor Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot,
                  App Store, Play Store, Quora, and Dev.to. The Free plan includes Reddit only.
                  Pro includes 8 platforms, and Team includes all 9.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="refresh">
                <AccordionTrigger>How often are results refreshed?</AccordionTrigger>
                <AccordionContent>
                  Free plans refresh once per day. Pro plans refresh every 4 hours (6x faster).
                  Team plans refresh every 2 hours (12x faster than free) with real-time email alerts.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="day-pass">
                <AccordionTrigger>What is the Day Pass?</AccordionTrigger>
                <AccordionContent>
                  The Day Pass gives you full Pro access for 24 hours with a one-time $10 payment.
                  Perfect for when you need to quickly check all platforms or do intensive research
                  without committing to a subscription. You can purchase multiple Day Passes whenever needed.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <Image
                  src="/logo.jpg"
                  alt="Kaulby"
                  width={28}
                  height={28}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="text-xl font-bold gradient-text">Kaulby</span>
            </Link>
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
          <div className="flex gap-6">
            <Link href="/articles" className="text-sm text-muted-foreground hover:text-foreground">
              Articles
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={selectedPlan}
        planName={selectedPlanName}
        billingInterval={billingInterval}
      />
    </div>
  );
}
