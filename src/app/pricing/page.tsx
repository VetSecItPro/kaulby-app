"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
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
import { Check } from "lucide-react";
import { CheckoutModal } from "@/components/checkout-modal";

const plans = [
  {
    name: "Free",
    key: "free" as const,
    description: "Get started with basic monitoring",
    price: "$0",
    period: "forever",
    features: [
      "1 monitor",
      "Reddit only",
      "3 keywords per monitor",
      "View last 3 results",
      "3-day history",
      "Basic AI analysis",
    ],
    cta: "Get Started",
    href: "/sign-up",
    popular: false,
  },
  {
    name: "Pro",
    key: "pro" as const,
    description: "For power users and professionals",
    price: "$29",
    period: "per month",
    features: [
      "10 monitors",
      "8 platforms (Reddit, HN, PH, Google Reviews, Trustpilot, App Store, Play Store, Quora)",
      "20 keywords per monitor",
      "Unlimited results",
      "90-day history",
      "Real-time monitoring",
      "Full AI analysis with pain point detection",
      "Email + Slack alerts",
      "Daily & weekly digests",
      "CSV export",
    ],
    cta: "Start Free Trial",
    href: "/sign-up?plan=pro",
    popular: true,
  },
  {
    name: "Team",
    key: "enterprise" as const, // Keep key as enterprise for backwards compatibility
    description: "For growing teams and agencies",
    price: "$99",
    period: "per month",
    features: [
      "Everything in Pro",
      "Unlimited monitors",
      "All 9 platforms (includes Dev.to)",
      "50 keywords per monitor",
      "1-year history",
      "Full AI + Ask feature",
      "All alert channels + webhooks",
      "API access",
      "5 team seats included (+$15/user)",
      "Priority support",
    ],
    cta: "Start Free Trial",
    href: "/sign-up?plan=enterprise",
    popular: false,
  },
];

export default function PricingPage() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise">("pro");
  const [selectedPlanName, setSelectedPlanName] = useState("Pro");

  const handleUpgrade = (planKey: "pro" | "enterprise", planName: string) => {
    setSelectedPlan(planKey);
    setSelectedPlanName(planName);
    setCheckoutOpen(true);
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
            <SignedOut>
              <Link href="/sign-in">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button>Get Started</Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            </SignedIn>
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
              Choose the plan that fits your needs. All plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <SignedOut>
                    <Link href={plan.href} className="w-full">
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  </SignedOut>
                  <SignedIn>
                    {plan.key === "free" ? (
                      <Button className="w-full" variant="outline" disabled>
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => handleUpgrade(plan.key as "pro" | "enterprise", plan.name)}
                      >
                        Upgrade to {plan.name}
                      </Button>
                    )}
                  </SignedIn>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
                <p className="text-muted-foreground text-sm">
                  Yes, you can cancel your subscription at any time. You&apos;ll continue to have
                  access until the end of your billing period.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What platforms do you monitor?</h3>
                <p className="text-muted-foreground text-sm">
                  We monitor Reddit, Hacker News, Product Hunt, Google Reviews, Trustpilot,
                  App Store, Play Store, Quora, and Dev.to. Platform availability varies by plan.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">How does the free trial work?</h3>
                <p className="text-muted-foreground text-sm">
                  All paid plans include a 14-day free trial. No credit card required to start.
                  You&apos;ll only be charged if you decide to continue after the trial.
                </p>
              </div>
            </div>
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
      />
    </div>
  );
}
