import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  Radar,
  Zap,
  Globe,
} from "lucide-react";
import { TOOL_BY_SLUG, ALL_TOOL_SLUGS, TOOLS } from "@/lib/data/tools";
import { ToolPageSchema } from "@/lib/seo/structured-data";

// ISR: Revalidate every 24 hours
export const revalidate = 86400;

export async function generateStaticParams() {
  return ALL_TOOL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOL_BY_SLUG[slug];

  if (!tool) {
    return { title: "Tool Not Found | Kaulby" };
  }

  const title = `${tool.title} | Kaulby`;

  return {
    title,
    description: tool.description,
    keywords: tool.keywords,
    openGraph: {
      title,
      description: tool.description,
      type: "website",
      url: `https://kaulbyapp.com/tools/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tool.description,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/tools/${slug}`,
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = TOOL_BY_SLUG[slug];

  if (!tool) {
    notFound();
  }

  const otherTools = TOOLS.filter((t) => t.slug !== slug).slice(0, 4);

  return (
    <>
      {/* Structured Data */}
      <ToolPageSchema
        name={`${tool.title} - Kaulby`}
        description={tool.description}
        url={`https://kaulbyapp.com/tools/${slug}`}
        features={tool.features}
      />

      {/* Hero Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-background to-teal-950/30" />
        <div className="container relative mx-auto max-w-4xl text-center">
          <Badge
            variant="secondary"
            className="mb-4 text-sm px-4 py-1 border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
          >
            Free Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-indigo-200 to-cyan-200 bg-clip-text text-transparent">
            {tool.title}
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            {tool.description}
          </p>
          <p className="text-base text-muted-foreground/80 mb-8 max-w-2xl mx-auto">
            {tool.longDescription}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=tool-${slug}`}>
              <Button
                size="lg"
                className="gap-2 text-lg px-8 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500"
              >
                {tool.cta}
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
            Free tier available. No credit card required.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/30 border-y border-border/50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              What You Get
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Everything included with {tool.title.toLowerCase()}, powered by AI.
            </p>
          </div>
          <div className="space-y-4">
            {tool.features.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-4 p-5 rounded-xl bg-background border border-border/50 hover:border-indigo-500/30 transition-colors"
              >
                <CheckCircle2 className="h-6 w-6 text-cyan-400 mt-0.5 shrink-0" />
                <span className="text-base">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Globe className="h-6 w-6 text-indigo-400" />
            <h2 className="text-2xl font-bold">
              Supported Platforms
            </h2>
          </div>
          <p className="text-muted-foreground mb-8">
            {tool.title} works across these platforms.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {tool.platforms.map((platform) => (
              <Badge
                key={platform}
                variant="outline"
                className="text-base px-4 py-2 border-indigo-500/20 bg-indigo-500/5"
              >
                {platform}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30 border-y border-border/50">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: Radar,
                title: "Set Up Keywords",
                description:
                  "Add your brand name, competitor names, or any keywords you want to track.",
              },
              {
                step: "2",
                icon: Zap,
                title: "AI Scans Platforms",
                description:
                  "Kaulby continuously scans selected platforms and analyzes every mention with AI.",
              },
              {
                step: "3",
                icon: CheckCircle2,
                title: "Get Insights & Alerts",
                description:
                  "Receive instant alerts and AI-generated summaries with sentiment and action items.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-7 w-7 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-cyan-600 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Using {tool.title} Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join teams using Kaulby to monitor what matters. Set up in under 2 minutes.
          </p>
          <Link href={`/sign-up?ref=tool-${slug}`}>
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              {tool.cta}
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Other Tools */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">
            Explore More Tools
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {otherTools.map((t) => (
              <Link key={t.slug} href={`/tools/${t.slug}`}>
                <Card className="h-full hover:bg-muted/50 hover:border-indigo-500/30 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{t.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {t.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/tools">
              <Button variant="outline" className="gap-2">
                View All Tools
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
