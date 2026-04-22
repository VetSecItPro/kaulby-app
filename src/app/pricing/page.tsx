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
import { FAQSchema } from "@/lib/seo/structured-data";
import { track as trackClient } from "@/lib/analytics-client";

interface Feature {
  text: string;
  comingSoon?: boolean;
}

interface Plan {
  name: string;
  key: "free" | "pro" | "team";
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

const plans: Plan[] = [
  {
    name: "Free",
    key: "free",
    description: "Get started with basic monitoring",
    useCase: "Perfect for solo founders validating an idea on Reddit",
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
    useCase: "Built for marketers and product teams tracking brand mentions",
    monthlyPrice: 29,
    annualPrice: 290,
    trialDays: 14,
    features: [
      { text: "10 monitors" },
      { text: "9 platforms (Reddit, HN, IH, PH, Google, YouTube, GitHub, Trustpilot, X)" },
      { text: "10 keywords per monitor" },
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
    key: "team",
    description: "For growing teams and agencies",
    useCase: "Designed for agencies and teams managing multiple brands",
    monthlyPrice: 99,
    annualPrice: 990,
    trialDays: 14,
    features: [
      { text: "Everything in Pro" },
      { text: "30 monitors" },
      { text: "All 16 platforms" },
      { text: "20 keywords per monitor" },
      { text: "1-year history" },
      { text: "2-hour refresh cycle" },
      { text: "Comprehensive AI analysis" },
      { text: "Twice-daily email digests" },
      { text: "Webhooks" },
      { text: "3 team seats (+$20/user)" },
      { text: "API access" },
    ],
    cta: "Sign Up for Team",
    href: "/sign-up?plan=team",
    popular: false,
  },
];

// Feature comparison table data
const featureComparison = [
  { feature: "Monitors", free: "1", pro: "10", team: "30" },
  { feature: "Keywords per monitor", free: "3", pro: "10", team: "20" },
  { feature: "Platforms", free: "Reddit only", pro: "9 platforms", team: "All 16 platforms" },
  { feature: "Results visible", free: "Last 3", pro: "Unlimited", team: "Unlimited" },
  { feature: "History retention", free: "3 days", pro: "90 days", team: "1 year" },
  { feature: "Refresh cycle", free: "24 hours", pro: "4 hours", team: "2 hours" },
  { feature: "AI sentiment analysis", free: true, pro: true, team: true },
  { feature: "AI pain point detection", free: false, pro: true, team: true },
  { feature: "Comprehensive AI analysis", free: false, pro: false, team: true },
  { feature: "Email digests", free: false, pro: "Daily", team: "Twice daily" },
  { feature: "Slack/Discord alerts", free: false, pro: true, team: true },
  { feature: "Webhooks", free: false, pro: false, team: true },
  { feature: "CSV export", free: false, pro: true, team: true },
  { feature: "API access", free: false, pro: false, team: true },
  { feature: "Team seats", free: "-", pro: "1", team: "3 (+$20/user)" },
];

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "team">("pro");
  const [selectedPlanName, setSelectedPlanName] = useState("Pro");
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

  const handleUpgrade = (planKey: "pro" | "team", planName: string) => {
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
          {/* A11Y: Consider wrapping in <nav> — FIX-303 */}
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
              Start free and upgrade when you need advanced monitoring and full AI insights.
            </p>
            <p className="text-sm text-primary font-medium mt-4">
              First 1,000 Founding Members lock in Pro or Team price forever
            </p>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>14-day money-back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-green-500" />
                <span>No credit card for free tier</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
                    {plan.monthlyPrice > 0 ? (
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
                    currentPlan === plan.key ? (
                      plan.key === "free" ? (
                        <Link href="/dashboard" className="w-full">
                          <Button className="w-full" variant="outline">
                            Continue with Free
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      ) : (
                        <Button className="w-full" variant="outline" disabled>
                          Current Plan
                        </Button>
                      )
                    ) : plan.key === "free" ? (
                      <Link href="/dashboard" className="w-full">
                        <Button className="w-full" variant="outline">
                          Continue with Free
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => handleUpgrade(plan.key as "pro" | "team", plan.name)}
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
                    <span className="text-sm">9 Pro platforms</span>
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
            {/* A11Y: Mobile scroll — FIX-317 */}
            <div className="overflow-x-auto">
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
          </div>

          {/* Testimonials */}
          <TestimonialStrip />

          {/* FAQ Schema for SEO/AEO */}
          <FAQSchema faqs={[
            { question: "Is there really a free plan?", answer: "Yes! The Free plan is free forever. You can monitor 1 keyword on Reddit with basic AI analysis and daily refresh." },
            { question: "How does the 14-day free trial work?", answer: "Pro and Team plans include a 14-day free trial with full access to all features. You won't be charged until the trial ends. Cancel anytime during the trial." },
            { question: "Can I cancel anytime?", answer: "Yes, you can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your current billing period." },
            { question: "What platforms does Kaulby monitor?", answer: "Kaulby monitors 16 platforms: Reddit, Hacker News, Indie Hackers, Product Hunt, Google Reviews, YouTube, GitHub, Trustpilot, X (Twitter), Dev.to, Hashnode, App Store, Play Store, G2, Yelp, and Amazon Reviews." },
            { question: "How is Kaulby different from Brand24?", answer: "Kaulby focuses on community monitoring with AI-powered pain point detection and sentiment analysis across 16 platforms, starting at $29/mo. Brand24 starts at $99/mo and focuses on broader social media monitoring." },
            { question: "What replaced GummySearch?", answer: "Kaulby is the best GummySearch alternative. It covers Reddit plus 16 additional platforms, includes AI-powered analysis, and offers a free tier. Visit kaulbyapp.com/gummysearch for migration details." },
            { question: "What is the Day Pass?", answer: "The Day Pass gives you full Pro access for 24 hours with a one-time $10 payment. Perfect for quick research without committing to a subscription." },
            { question: "How often are results refreshed?", answer: "Free plans refresh once per day. Pro plans refresh every 4 hours. Team plans refresh every 2 hours with twice-daily email digests." },
            { question: "Is my data secure?", answer: "Yes. We use industry-standard encryption, are GDPR compliant, and you can export or delete your data at any time." },
            { question: "What is the Founding Members program?", answer: "The first 1,000 Pro and Team subscribers become Founding Members and lock in their current price forever, even when prices increase." },
            { question: "What happens when I hit my monitor or keyword limit?", answer: "Your existing monitors keep working normally. You won't be able to create new monitors or add more keywords until you upgrade. We'll prompt you to upgrade when you reach your limit." },
            { question: "Do you offer startup or nonprofit discounts?", answer: "Yes! We offer case-by-case discounts for startups, nonprofits, and open-source projects. Contact us at support@kaulbyapp.com." },
          ]} />

          {/* FAQ Section */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            {/* A11Y: Keyboard navigation instructions — FIX-322 */}
            <p className="sr-only">Use arrow keys to navigate questions. Press Enter or Space to expand.</p>
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
                  We monitor 16 platforms total: Reddit, Hacker News, Indie Hackers, Product Hunt,
                  Google Reviews, YouTube, GitHub, Trustpilot, X (Twitter), Dev.to, Hashnode, App Store, Play Store,
                  G2, Yelp, and Amazon Reviews. The Free plan includes Reddit only.
                  Pro includes 9 core platforms (Reddit, HN, Indie Hackers, Product Hunt, Google Reviews, YouTube, GitHub, Trustpilot, X).
                  Team includes all 16 platforms.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="refresh">
                <AccordionTrigger>How often are results refreshed?</AccordionTrigger>
                <AccordionContent>
                  Free plans refresh once per day. Pro plans refresh every 4 hours (6x faster).
                  Team plans refresh every 2 hours (12x faster than free) with twice-daily email digests.
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
                  The first 1,000 Pro and Team subscribers become Founding Members and lock in their current
                  price forever, even when we raise prices in the future. This is our way of thanking early
                  supporters who believe in Kaulby.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="data-security">
                <AccordionTrigger>Is my data secure?</AccordionTrigger>
                <AccordionContent>
                  Yes. We use industry-standard encryption for all data in transit and at rest.
                  Your monitoring data is stored securely and never shared with third parties.
                  We&apos;re GDPR compliant and you can export or delete your data at any time.
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
                  Start with our free tier - no credit card required. Monitor 1 keyword on Reddit
                  and see the AI analysis in action. Upgrade whenever you&apos;re ready.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/sign-up">
                    <Button size="lg" className="gap-2">
                      Start Free
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
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
