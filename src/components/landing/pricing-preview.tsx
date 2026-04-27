import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AnimatedSection,
  TextReveal,
} from "@/components/shared/home-animations-lazy";

interface PricingTier {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    features: [
      "1 monitor",
      "Reddit only",
      "3 keywords per monitor",
      "24hr refresh cycle",
      "Basic sentiment analysis",
    ],
    cta: "Start Free",
    href: "/sign-up",
  },
  {
    name: "Solo",
    price: "$39",
    period: "/month",
    features: [
      "10 monitors",
      "9 platforms",
      "Unlimited keywords",
      "6hr refresh cycle",
      "Full AI analysis + lead scoring",
      "Email alerts + Slack",
    ],
    cta: "Start Solo Trial",
    href: "/sign-up?plan=solo",
  },
  {
    name: "Scale",
    price: "$79",
    period: "/month",
    features: [
      "20 monitors",
      "12 platforms (+ G2, Yelp, Amazon)",
      "Unlimited keywords",
      "4hr refresh cycle",
      "All Solo features",
      "180-day history",
    ],
    cta: "Start Scale Trial",
    href: "/sign-up?plan=scale",
    highlighted: true,
  },
  {
    name: "Growth",
    price: "$149",
    period: "/month",
    features: [
      "30 monitors",
      "All 16 platforms",
      "2hr refresh cycle",
      "Comprehensive AI + API access",
      "Team workspaces + webhooks",
      "3 team seats included",
    ],
    cta: "Start Growth Trial",
    href: "/sign-up?plan=growth",
  },
];

export function PricingPreview() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <AnimatedSection className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Pricing
          </Badge>
          <TextReveal>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Simple, transparent pricing
            </h2>
          </TextReveal>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free. Upgrade when you need more platforms, monitors, and AI
            depth.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, index) => (
            <AnimatedSection key={tier.name} delay={index * 0.1}>
              <Card
                className={cn(
                  "relative flex flex-col p-6 h-full bg-card/50 backdrop-blur-sm border",
                  tier.highlighted
                    ? "border-teal-500 shadow-lg shadow-teal-500/10"
                    : "border-border"
                )}
              >
                {tier.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-500 text-white hover:bg-teal-600">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white">
                    {tier.name}
                  </h3>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-4xl font-bold tracking-tight text-white">
                      {tier.price}
                    </span>
                    <span className="ml-1 text-sm text-muted-foreground">
                      {tier.period}
                    </span>
                  </div>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={tier.highlighted ? "default" : "outline"}
                  className={cn(
                    "w-full",
                    tier.highlighted &&
                      "bg-teal-500 text-white hover:bg-teal-600"
                  )}
                >
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </Card>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection delay={0.4} className="mt-10 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-500 hover:text-teal-400 transition-colors"
          >
            View full comparison
            <ArrowRight className="h-4 w-4" />
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
