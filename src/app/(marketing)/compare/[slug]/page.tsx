import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react";
import { COMPETITOR_BY_SLUG, ALL_COMPETITOR_SLUGS, COMPETITORS } from "@/lib/data/competitors";
import { ComparisonSchema, FAQSchema } from "@/lib/seo/structured-data";

// ISR: Revalidate every 24 hours
export const revalidate = 86400;

export async function generateStaticParams() {
  return ALL_COMPETITOR_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competitor = COMPETITOR_BY_SLUG[slug];

  if (!competitor) {
    return { title: "Comparison Not Found | Kaulby" };
  }

  const title = `Kaulby vs ${competitor.name} | ${competitor.name} Alternative | Kaulby`;

  return {
    title,
    description: competitor.metaDescription,
    keywords: [
      `${competitor.name} alternative`,
      `${competitor.name} vs Kaulby`,
      `Kaulby vs ${competitor.name}`,
      `${competitor.name} competitor`,
      "brand monitoring tool",
      "social listening alternative",
    ],
    openGraph: {
      title,
      description: competitor.metaDescription,
      type: "website",
      url: `https://kaulbyapp.com/compare/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: competitor.metaDescription,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/compare/${slug}`,
    },
  };
}

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />;
  }
  if (value === false) {
    return <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />;
  }
  // String value (like "Limited", "$29/mo", etc.)
  return <span className="text-sm font-medium">{value}</span>;
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competitor = COMPETITOR_BY_SLUG[slug];

  if (!competitor) {
    notFound();
  }

  // Get other competitors for cross-linking
  const otherCompetitors = COMPETITORS.filter((c) => c.slug !== slug).slice(0, 6);

  return (
    <>
      {/* Structured Data */}
      <ComparisonSchema
        productName="Kaulby"
        competitorName={competitor.name}
        url={`https://kaulbyapp.com/compare/${slug}`}
      />
      <FAQSchema faqs={competitor.faqs} />

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            Comparison
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Kaulby vs {competitor.name}
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            {competitor.description}
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {competitor.category}
            </Badge>
            <Minus className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline" className="text-sm px-3 py-1">
              {competitor.pricing}
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=compare-${slug}`}>
              <Button size="lg" className="gap-2 text-lg px-8">
                Try Kaulby Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Feature Comparison
          </h2>
          <div className="rounded-lg border overflow-hidden bg-background">
            {/* Table Header */}
            <div className="grid grid-cols-3 gap-0 border-b bg-muted/50">
              <div className="p-4 font-semibold text-sm">Feature</div>
              <div className="p-4 font-semibold text-sm text-center border-x">Kaulby</div>
              <div className="p-4 font-semibold text-sm text-center">{competitor.name}</div>
            </div>
            {/* Table Rows */}
            {competitor.features.map((feature, index) => (
              <div
                key={feature.name}
                className={`grid grid-cols-3 gap-0 ${
                  index < competitor.features.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="p-4 text-sm">{feature.name}</div>
                <div className="p-4 text-center border-x">
                  <FeatureCell value={feature.kaulby} />
                </div>
                <div className="p-4 text-center">
                  <FeatureCell value={feature.competitor} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages Comparison */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Kaulby Advantages */}
            <div>
              <h2 className="text-2xl font-bold mb-6">
                Why Choose Kaulby
              </h2>
              <div className="space-y-3">
                {competitor.kaulbyAdvantages.map((advantage) => (
                  <div key={advantage} className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-sm">{advantage}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitor Advantages */}
            <div>
              <h2 className="text-2xl font-bold mb-6">
                Why Choose {competitor.name}
              </h2>
              <div className="space-y-3">
                {competitor.competitorAdvantages.map((advantage) => (
                  <div key={advantage} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-sm">{advantage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Pricing Comparison
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Kaulby Pricing */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <Badge className="w-fit mb-2">Recommended</Badge>
                <CardTitle className="text-2xl">Kaulby</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">$0</span>
                    <span className="text-muted-foreground">/mo</span>
                    <Badge variant="outline">Free tier</Badge>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">$39</span>
                    <span className="text-muted-foreground">/mo for Solo</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">$79</span>
                    <span className="text-muted-foreground">/mo for Scale</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">$149</span>
                    <span className="text-muted-foreground">/mo for Growth</span>
                  </div>
                  <ul className="space-y-2 pt-4 border-t">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Free tier with Reddit monitoring
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      14-day free trial on paid plans
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      No credit card for free tier
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      2 months free with annual billing
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Competitor Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{competitor.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{competitor.pricing}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {competitor.name}&apos;s pricing starts at {competitor.pricing}.
                    Visit their website for current plan details.
                  </p>
                  <div className="pt-4 border-t">
                    <a
                      href={competitor.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Visit {competitor.name} website
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {competitor.faqs.map((faq) => (
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
            Switch to Kaulby Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Get better community monitoring at a fraction of the cost. Start with the free tier - no credit card required.
          </p>
          <Link href={`/sign-up?ref=compare-${slug}`}>
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Other Comparisons */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">
            Other Comparisons
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {otherCompetitors.map((c) => (
              <Link key={c.slug} href={`/compare/${c.slug}`}>
                <Badge
                  variant="outline"
                  className="text-base px-4 py-2 cursor-pointer hover:bg-muted"
                >
                  vs {c.name}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
