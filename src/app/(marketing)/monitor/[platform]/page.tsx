import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Bell,
  Brain,
  Search,
  Zap,
  CheckCircle2,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { PLATFORM_BY_SLUG, ALL_PLATFORM_SLUGS, PLATFORMS } from "@/lib/data/platforms";
import { FAQSchema, HowToSchema, ToolPageSchema } from "@/lib/seo/structured-data";

// ISR: Revalidate every 24 hours
export const revalidate = 86400;

export async function generateStaticParams() {
  return ALL_PLATFORM_SLUGS.map((platform) => ({ platform }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}): Promise<Metadata> {
  const { platform: slug } = await params;
  const platform = PLATFORM_BY_SLUG[slug];

  if (!platform) {
    return { title: "Platform Not Found | Kaulby" };
  }

  const title = `Monitor ${platform.name} Mentions | ${platform.name} Monitoring Tool | Kaulby`;
  const description = platform.description;

  return {
    title,
    description,
    keywords: [
      `${platform.name} monitoring`,
      `${platform.name} mentions`,
      `monitor ${platform.name}`,
      `${platform.name} alerts`,
      `${platform.name} sentiment analysis`,
      "brand monitoring",
      "social listening",
    ],
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://kaulbyapp.com/monitor/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/monitor/${slug}`,
    },
  };
}

const stepIcons = [Search, Brain, Bell];

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform: slug } = await params;
  const platform = PLATFORM_BY_SLUG[slug];

  if (!platform) {
    notFound();
  }

  const tierLabel =
    platform.tier === "free"
      ? "Free"
      : platform.tier === "solo"
        ? "Solo"
        : platform.tier === "scale"
          ? "Scale"
          : "Growth";

  const tierColor =
    platform.tier === "free"
      ? "bg-green-500/10 text-green-500"
      : platform.tier === "solo"
        ? "bg-blue-500/10 text-blue-500"
        : "bg-purple-500/10 text-purple-500";

  // Get other platforms for cross-linking
  const otherPlatforms = PLATFORMS.filter((p) => p.slug !== slug).slice(0, 8);

  const howToSteps = [
    {
      name: "Create a Monitor",
      text: `Sign up for Kaulby and create a new monitor. Select ${platform.name} as your platform and enter your keywords.`,
    },
    {
      name: "AI Analyzes Mentions",
      text: `Kaulby scans ${platform.name} for your keywords, analyzing sentiment and categorizing each mention automatically.`,
    },
    {
      name: "Get Alerts",
      text: "Receive notifications via email, Slack, or webhooks when new mentions are found. Review results in your dashboard.",
    },
  ];

  return (
    <>
      {/* Structured Data */}
      <ToolPageSchema
        name={`${platform.name} Monitoring Tool - Kaulby`}
        description={platform.description}
        url={`https://kaulbyapp.com/monitor/${slug}`}
        features={platform.features.map((f) => f.title)}
      />
      <FAQSchema faqs={platform.faqs} />
      <HowToSchema
        name={`How to Monitor ${platform.name} Mentions`}
        description={`Set up ${platform.name} monitoring with Kaulby in 3 simple steps.`}
        steps={howToSteps}
      />

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge className={`mb-4 text-sm px-4 py-1 ${tierColor}`}>
            Available on {tierLabel} plan
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            {platform.heroHeadline}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {platform.heroDescription}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=monitor-${slug}`}>
              <Button size="lg" className="gap-2 text-lg px-8">
                Start Monitoring {platform.shortName}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            $15 Day Pass to try. No subscription required.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            {platform.name} Monitoring Features
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Everything you need to monitor {platform.name} mentions and extract actionable insights.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {platform.features.map((feature, index) => {
              const icons = [Search, Brain, BarChart3, Zap, MessageSquare, Bell];
              const Icon = icons[index % icons.length];
              return (
                <Card key={feature.title}>
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            How to Monitor {platform.name} in 3 Steps
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {howToSteps.map((step, index) => {
              const StepIcon = stepIcons[index];
              return (
                <div key={step.name} className="text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <StepIcon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {index + 1}. {step.name}
                  </h3>
                  <p className="text-muted-foreground">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Why Monitor {platform.name}?
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Businesses use Kaulby to monitor {platform.name} for these common use cases.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {platform.useCases.map((useCase) => (
              <div key={useCase} className="flex items-start gap-3 p-4 rounded-lg bg-background border">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-base">{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Keywords */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-6">
            Example Keywords to Track on {platform.name}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {platform.exampleKeywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-base px-4 py-2">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {platform.faqs.map((faq) => (
              <Card key={faq.question}>
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Monitoring {platform.name} Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Start monitoring {platform.name} conversations and find customers with Kaulby.
          </p>
          <Link href={`/sign-up?ref=monitor-${slug}`}>
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Other Platforms */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">
            Monitor Other Platforms
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {otherPlatforms.map((p) => (
              <Link key={p.slug} href={`/monitor/${p.slug}`}>
                <Badge
                  variant="outline"
                  className="text-base px-4 py-2 cursor-pointer hover:bg-muted"
                >
                  {p.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
