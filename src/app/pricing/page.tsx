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
import { Check, X, ShieldCheck, CreditCard, RefreshCw, ArrowRight } from "lucide-react";
import { CheckoutModal } from "@/components/checkout-modal";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { cn } from "@/lib/utils";
import { TestimonialStrip } from "@/components/landing/testimonials";
import { toast } from "sonner";
import type { BillingInterval } from "@/lib/plans";
import { TIER_DESCRIPTIONS, TIER_USE_CASES, TIER_PRICES_MONTHLY, TIER_PRICES_ANNUAL } from "@/lib/marketing/tier-copy";
import { FAQSchema } from "@/lib/seo/structured-data";
import { track as trackClient } from "@/lib/analytics-client";
import { FoundingMembersBanner } from "@/components/founding-members-banner";

interface Feature {
  text: string;
  comingSoon?: boolean;
}

interface Plan {
  name: string;
  key: "free" | "solo" | "scale" | "growth";
  description: string;
  useCase: string;
  monthlyPrice: number;
  annualPrice: number;
  features: Feature[];
  cta: string;
  href: string;
  popular: boolean;
  trialDays: number;
}

// Plans ordered in ascending price - Solo / Scale / Growth.
// Free tier removed 2026-04-27 (Apify costs); Day Pass ($15/24h) is now the
// try-before-buy entry point and renders in its own card on this page.
// Each tier's features list emphasizes what makes THAT tier different from the one before,
// not an exhaustive feature dump. The comparison table below handles the exhaustive view.
const plans: Plan[] = [
  {
    name: "Solo",
    key: "solo",
    description: TIER_DESCRIPTIONS.solo,
    useCase: TIER_USE_CASES.solo,
    monthlyPrice: TIER_PRICES_MONTHLY.solo,
    annualPrice: TIER_PRICES_ANNUAL.solo,
    trialDays: 14,
    features: [
      { text: "10 monitors" },
      { text: "9 platforms" },
      { text: "Unlimited keywords" },
      { text: "6-hour refresh + real-time Reddit" },
      { text: "90-day history" },
      { text: "Full AI + Ask Kaulby" },
      { text: "Daily digest, Slack alerts, CSV export" },
    ],
    cta: "Start Solo",
    href: "/sign-up?plan=solo",
    popular: false,
  },
  {
    name: "Scale",
    key: "scale",
    description: TIER_DESCRIPTIONS.scale,
    useCase: TIER_USE_CASES.scale,
    monthlyPrice: TIER_PRICES_MONTHLY.scale,
    annualPrice: TIER_PRICES_ANNUAL.scale,
    trialDays: 14,
    features: [
      { text: "20 monitors" },
      { text: "12 platforms (adds G2, Yelp, Amazon)" },
      { text: "Unlimited keywords" },
      { text: "4-hour refresh + real-time Reddit" },
      { text: "90-day history" },
      { text: "Full AI + Ask Kaulby" },
      { text: "Everything in Solo" },
    ],
    cta: "Start Scale",
    href: "/sign-up?plan=scale",
    popular: true,
  },
  {
    name: "Growth",
    key: "growth",
    description: TIER_DESCRIPTIONS.growth,
    useCase: TIER_USE_CASES.growth,
    monthlyPrice: TIER_PRICES_MONTHLY.growth,
    annualPrice: TIER_PRICES_ANNUAL.growth,
    trialDays: 14,
    features: [
      { text: "30 monitors" },
      { text: "All 16 platforms (adds Dev.to, Hashnode, App Store, Play Store)" },
      { text: "2-hour refresh + real-time Reddit & GitHub" },
      { text: "1-year history" },
      { text: "Comprehensive AI analyst reports" },
      { text: "Webhooks + REST API" },
      { text: "3 seats (+$20/mo each extra)" },
      { text: "Shared workspace + role permissions" },
    ],
    cta: "Start Growth",
    href: "/sign-up?plan=growth",
    popular: false,
  },
];

// Feature comparison - only rows with real tier differences. No "✓ everywhere" noise.
// Grouped mentally by buyer question: (1) what am I monitoring? (2) how smart is the AI?
// (3) how does it reach me? (4) can my team use it?
const featureComparison = [
  // MONITORING SCOPE
  { feature: "Active monitors", solo: "10", scale: "20", growth: "30" },
  { feature: "Keywords per monitor", solo: "Unlimited", scale: "Unlimited", growth: "Unlimited" },
  { feature: "Platforms", solo: "9", scale: "12", growth: "All 16" },
  { feature: "Refresh cadence", solo: "6 hr", scale: "4 hr", growth: "2 hr" },
  { feature: "Real-time channels", solo: "Reddit", scale: "Reddit", growth: "Reddit + GitHub" },
  { feature: "Result history", solo: "90 days", scale: "90 days", growth: "1 year" },
  // AI INTELLIGENCE
  { feature: "Sentiment + pain-point detection", solo: true, scale: true, growth: true },
  { feature: "Ask Kaulby (AI chat)", solo: true, scale: true, growth: true },
  { feature: "Comprehensive AI analyst reports", solo: false, scale: false, growth: true },
  { feature: "Email digest", solo: "Daily", scale: "Daily", growth: "Twice daily" },
  // DELIVERY & INTEGRATIONS
  { feature: "Email + Slack/Discord alerts", solo: true, scale: true, growth: true },
  { feature: "CSV export", solo: true, scale: true, growth: true },
  { feature: "Custom webhooks", solo: false, scale: false, growth: true },
  { feature: "REST API access", solo: false, scale: false, growth: true },
  // TEAM
  { feature: "Seats included", solo: "1", scale: "1", growth: "3" },
  { feature: "Additional seats", solo: "-", scale: "-", growth: "+$20/mo each" },
  { feature: "Shared workspace + roles", solo: false, scale: false, growth: true },
];

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"scale" | "solo" | "growth">("solo");
  const [selectedPlanName, setSelectedPlanName] = useState("Scale");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [dayPassStatus, setDayPassStatus] = useState<{
    active: boolean;
    expiresAt: string | null;
  } | null>(null);
  const [isPurchasingDayPass, setIsPurchasingDayPass] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  // Fetch day pass status and current plan for signed-in users
  useEffect(() => {
    if (!isSignedIn) return;

    const controller = new AbortController();

    fetch("/api/user/day-pass", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setDayPassStatus({
          active: data.active,
          expiresAt: data.expiresAt,
        });
      })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });

    fetch("/api/user/subscription", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setCurrentPlan(data.plan || "free");
      })
      .catch((err) => { if (err.name !== "AbortError") setCurrentPlan("free"); });

    return () => controller.abort();
  }, [isSignedIn]);

  const handleDayPassPurchase = async () => {
    // Client analytics: fires before navigation so the event survives the redirect.
    trackClient("ui.cta_clicked", { ctaName: "day_pass_purchase", location: "pricing_page" });
    setIsPurchasingDayPass(true);
    try {
      const response = await fetch("/api/polar/day-pass", {
        method: "POST",
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Day pass purchase error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setIsPurchasingDayPass(false);
    }
  };

  const handleUpgrade = (planKey: "scale" | "solo" | "growth", planName: string) => {
    // Funnel analytics: capture plan CTA clicks on the pricing page so we can
    // correlate intent -> checkout open -> payment.succeeded (server event).
    trackClient("ui.cta_clicked", {
      ctaName: `upgrade_${planKey}`,
      location: "pricing_page",
    });
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
                priority
              />
            </div>
            <span className="text-2xl font-bold gradient-text">Kaulby</span>
          </Link>
          {/* A11Y: Consider wrapping in <nav> - FIX-303 */}
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
              Try a Day Pass for 24 hours, or pick a plan. 14-day money-back guarantee on monthly.
            </p>
            <div className="mt-4 flex justify-center">
              <FoundingMembersBanner variant="hero" />
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>14-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-green-500" />
                <span>Day Pass: $15 for 24h, no subscription</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-green-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-10">
            <div className="inline-flex items-center rounded-full bg-muted p-1 relative">
              <button
                onClick={() => setBillingInterval("monthly")}
                aria-pressed={billingInterval === "monthly"} // A11Y: FIX-306
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
                aria-pressed={billingInterval === "annual"}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={cn(
                  "relative flex flex-col",
                  plan.popular && "border-primary shadow-lg lg:-translate-y-2 lg:scale-[1.02]"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="text-xs text-muted-foreground mt-1.5 italic">{plan.useCase}</p>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6 min-h-[72px]">
                    <div className="flex items-baseline gap-1">
                      {billingInterval === "annual" && plan.monthlyPrice > 0 && (
                        <span className="text-lg line-through text-muted-foreground mr-1">${plan.monthlyPrice}</span>
                      )}
                      <span className="text-4xl font-bold">{getDisplayPrice(plan)}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-sm text-muted-foreground">
                        {billingInterval === "annual"
                          ? `Billed annually ($${plan.annualPrice}/year)`
                          : `Billed monthly`}
                      </p>
                      {billingInterval === "annual" && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-[10px]">
                          Save ${plan.monthlyPrice * 12 - plan.annualPrice}/yr
                        </Badge>
                      )}
                    </div>
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
                  ) : currentPlan === plan.key ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleUpgrade(plan.key as "scale" | "solo" | "growth", plan.name)}
                    >
                      {plan.cta}
                    </Button>
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
                <CardDescription>Try Scale features for 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6 min-h-[72px]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-amber-700 dark:text-amber-300">$15</span>
                    <span className="text-amber-600 dark:text-amber-400">/24hr</span>
                  </div>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-1">
                    One-time, no subscription
                  </p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">Full Scale features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">12 platforms</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">Unlimited results</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-sm">Full AI analysis</span>
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
                      {isPurchasingDayPass ? "Processing..." : "Get Day Pass - $15"}
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
            {/* A11Y: Mobile scroll - FIX-317 */}
            <div className="overflow-x-auto">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[240px]">Feature</TableHead>
                      <TableHead className="text-center">Solo</TableHead>
                      <TableHead className="text-center bg-primary/5">
                        <div className="flex items-center justify-center gap-1">
                          Scale
                          <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">Growth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {featureComparison.map((row) => {
                      const renderCell = (v: string | boolean) => {
                        if (typeof v === "boolean") {
                          return v ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />
                          );
                        }
                        return <span className="text-sm">{v}</span>;
                      };
                      return (
                        <TableRow key={row.feature}>
                          <TableCell className="font-medium">{row.feature}</TableCell>
                          <TableCell className="text-center">{renderCell(row.solo)}</TableCell>
                          <TableCell className="text-center bg-primary/5">{renderCell(row.scale)}</TableCell>
                          <TableCell className="text-center">{renderCell(row.growth)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <TestimonialStrip />

          {/* FAQ Schema for SEO/AEO */}
          <FAQSchema faqs={[
            { question: "How can I try Kaulby before subscribing?", answer: "We offer a Day Pass: $15 for 24 hours of full Scale-tier access (10 monitors, 12 platforms, full AI analysis). No subscription required. Perfect for one-off research or kicking the tires before committing to a monthly plan." },
            { question: "How does the 14-day money-back guarantee work?", answer: "All monthly paid plans come with a 14-day money-back guarantee. If you're not satisfied within the first 14 days of your initial payment, contact support@kaulbyapp.com for a full refund. No questions asked." },
            { question: "Can I cancel anytime?", answer: "Yes, you can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your current billing period." },
            { question: "What platforms does Kaulby monitor?", answer: "Kaulby monitors 16 platforms: Reddit, Hacker News, Indie Hackers, Product Hunt, Google Reviews, YouTube, GitHub, Trustpilot, X (Twitter), Dev.to, Hashnode, App Store, Play Store, G2, Yelp, and Amazon Reviews." },
            { question: "How is Kaulby different from Brand24?", answer: "Kaulby focuses on community monitoring with AI-powered pain point detection and sentiment analysis across 16 platforms, starting at $39/mo. Brand24 starts at $99/mo and focuses on broader social media monitoring." },
            { question: "What replaced GummySearch?", answer: "Kaulby is the best GummySearch alternative. It covers Reddit plus 15 additional platforms with AI-powered analysis. Visit kaulbyapp.com/gummysearch for migration details." },
            { question: "How often are results refreshed?", answer: "Solo refreshes every 6 hours. Scale every 4 hours. Growth every 2 hours, with twice-daily email digests." },
            { question: "Is my data secure?", answer: "Yes. We use industry-standard encryption, are GDPR compliant, and you can export or delete your data at any time." },
            { question: "What is the Founding Members program?", answer: "The first 1,000 paid subscribers become Founding Members and lock in their current price forever, even when prices increase." },
            { question: "What happens when I hit my monitor or keyword limit?", answer: "Your existing monitors keep working normally. You won't be able to create new monitors or add more keywords until you upgrade. We'll prompt you to upgrade when you reach your limit." },
            { question: "Do you offer startup or nonprofit discounts?", answer: "Yes! We offer case-by-case discounts for startups, nonprofits, and open-source projects. Contact us at support@kaulbyapp.com." },
          ]} />

          {/* FAQ Section */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            {/* A11Y: Keyboard navigation instructions - FIX-322 */}
            <p className="sr-only">Use arrow keys to navigate questions. Press Enter or Space to expand.</p>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="day-pass-trial">
                <AccordionTrigger>How can I try Kaulby before subscribing?</AccordionTrigger>
                <AccordionContent>
                  Grab a Day Pass: $15 for 24 hours of full Scale-tier access (10 monitors, 12 platforms,
                  full AI analysis). No subscription, no auto-renewal. It&apos;s the fastest way to see if Kaulby
                  fits your workflow before picking a monthly plan.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="money-back-trial">
                <AccordionTrigger>What about a free trial on the monthly plans?</AccordionTrigger>
                <AccordionContent>
                  All monthly plans come with a 14-day money-back guarantee instead of a free trial. You pay
                  upfront, get full access immediately, and if you&apos;re not satisfied within the first 14 days,
                  email support@kaulbyapp.com for a full refund. No questions asked.
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
                  Yes. Tier changes (up or down) take effect at the start of your next billing period.
                  You keep your current tier through the period you already paid for, no proration.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="annual">
                <AccordionTrigger>How does annual billing work?</AccordionTrigger>
                <AccordionContent>
                  Annual saves you ~20% versus monthly: Solo $374/yr ($31/mo equivalent),
                  Scale $758/yr ($63/mo), Growth $1,430/yr ($119/mo).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="platforms">
                <AccordionTrigger>What platforms do you monitor?</AccordionTrigger>
                <AccordionContent>
                  We monitor 16 platforms total: Reddit, Hacker News, Indie Hackers, Product Hunt,
                  Google Reviews, YouTube, GitHub, Trustpilot, X (Twitter), Dev.to, Hashnode, App Store, Play Store,
                  G2, Yelp, and Amazon Reviews. Solo includes 9 core platforms.
                  Scale adds G2, Yelp, and Amazon Reviews (12 total). Growth includes all 16.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="refresh">
                <AccordionTrigger>How often are results refreshed?</AccordionTrigger>
                <AccordionContent>
                  Solo refreshes every 6 hours. Scale every 4 hours. Growth every 2 hours,
                  with twice-daily email digests. All paid tiers also include real-time Reddit
                  alerts (Growth adds real-time GitHub).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="money-back">
                <AccordionTrigger>What is the money-back guarantee?</AccordionTrigger>
                <AccordionContent>
                  We offer a 14-day money-back guarantee on all paid plans. If you&apos;re not satisfied
                  with Kaulby for any reason, contact us within 14 days of your first payment for a full refund.
                  No questions asked.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="founding-member">
                <AccordionTrigger>What is the Founding Members program?</AccordionTrigger>
                <AccordionContent>
                  The first 1,000 paid subscribers on Solo and Growth lock in their
                  current price forever, even when we raise prices later.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="data-security">
                <AccordionTrigger>Is my data secure?</AccordionTrigger>
                <AccordionContent>
                  Yes. Industry-standard encryption in transit and at rest, GDPR compliant,
                  and you can export or delete your data at any time.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="limits">
                <AccordionTrigger>What happens when I hit my monitor or keyword limit?</AccordionTrigger>
                <AccordionContent>
                  Your existing monitors keep working normally. You simply won&apos;t be able to create
                  new monitors or add more keywords until you upgrade to a higher plan. We&apos;ll show
                  you a prompt to upgrade when you reach your limit.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="discounts">
                <AccordionTrigger>Do you offer startup or nonprofit discounts?</AccordionTrigger>
                <AccordionContent>
                  Yes! We offer case-by-case discounts for startups, nonprofits, and open-source projects.
                  Contact us at support@kaulbyapp.com with details about your organization.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Final CTA */}
          <div className="mt-20 text-center">
            <Card className="max-w-2xl mx-auto bg-primary/5 border-primary/20">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-2">Still not sure?</h3>
                <p className="text-muted-foreground mb-6">
                  Try a Day Pass for $15. Full Scale-tier access for 24 hours, no subscription.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={handleDayPassPurchase}
                    disabled={isPurchasingDayPass}
                  >
                    {isPurchasingDayPass ? "Loading..." : "Get Day Pass - $15"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Link href="/gummysearch">
                    <Button size="lg" variant="outline">
                      Coming from GummySearch?
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <MarketingFooter />

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
