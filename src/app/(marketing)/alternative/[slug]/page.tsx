import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  ALTERNATIVE_BY_SLUG,
  ALL_ALTERNATIVE_SLUGS,
  ALTERNATIVES,
} from "@/lib/data/alternatives";

export const revalidate = 86400;

export async function generateStaticParams() {
  return ALL_ALTERNATIVE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const alt = ALTERNATIVE_BY_SLUG[slug];

  if (!alt) {
    return { title: "Alternative Not Found | Kaulby" };
  }

  const title = `Kaulby vs ${alt.name} — Community Monitoring Comparison`;

  return {
    title,
    description: alt.metaDescription,
    keywords: [
      `${alt.name} alternative`,
      `${alt.name} vs Kaulby`,
      `Kaulby vs ${alt.name}`,
      `best ${alt.name} alternative`,
      "community monitoring",
      "social listening alternative",
    ],
    openGraph: {
      title,
      description: alt.metaDescription,
      type: "website",
      url: `https://kaulbyapp.com/alternative/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: alt.metaDescription,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/alternative/${slug}`,
    },
  };
}

function FAQPageJsonLd({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <Script
      id="faq-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function AlternativePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const alt = ALTERNATIVE_BY_SLUG[slug];

  if (!alt) {
    notFound();
  }

  const otherAlternatives = ALTERNATIVES.filter((a) => a.slug !== slug);

  return (
    <>
      <FAQPageJsonLd faqs={alt.faqs} />

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            Alternative
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-indigo-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Kaulby
            </span>{" "}
            vs {alt.name}
          </h1>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            {alt.description}
          </p>
          <div className="flex items-center justify-center gap-3 mb-8">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {alt.platformCount}
            </Badge>
            <span className="text-muted-foreground">|</span>
            <Badge variant="outline" className="text-sm px-3 py-1">
              {alt.pricing}
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=alt-${slug}`}>
              <Button size="lg" className="gap-2 text-lg px-8">
                Try Kaulby Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-lg px-8"
              >
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Feature Comparison
          </h2>
          <div className="rounded-lg border overflow-hidden bg-background">
            {/* Header */}
            <div className="grid grid-cols-3 gap-0 border-b bg-muted/50">
              <div className="p-4 font-semibold text-sm">Feature</div>
              <div className="p-4 font-semibold text-sm text-center border-x">
                <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                  Kaulby
                </span>
              </div>
              <div className="p-4 font-semibold text-sm text-center">
                {alt.name}
              </div>
            </div>
            {/* Rows */}
            {alt.comparisonRows.map((row, index) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 gap-0 ${
                  index < alt.comparisonRows.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="p-4 text-sm font-medium">{row.feature}</div>
                <div className="p-4 text-center text-sm border-x">
                  {row.kaulby}
                </div>
                <div className="p-4 text-center text-sm">{row.competitor}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Limitations */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            {alt.name} Limitations
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Key gaps that Kaulby fills when you switch from {alt.name}.
          </p>
          <div className="space-y-3">
            {alt.limitations.map((limitation) => (
              <div
                key={limitation}
                className="flex items-start gap-3 p-4 rounded-lg border bg-muted/20"
              >
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-sm">{limitation}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Kaulby */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Teams Switch to Kaulby
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "17 Platforms",
                desc: "Reddit, Hacker News, Product Hunt, G2, Trustpilot, App Store, YouTube, X/Twitter, and more.",
              },
              {
                title: "AI Analysis",
                desc: "Every mention is analyzed for sentiment, category, and actionable pain points.",
              },
              {
                title: "Lead Scoring",
                desc: "Automatically score mentions by purchase intent so you focus on the best leads.",
              },
              {
                title: "Real-time Alerts",
                desc: "Get notified via email, Slack, or webhooks when keywords match.",
              },
              {
                title: "Free Tier",
                desc: "Start monitoring Reddit for free — no credit card required.",
              },
              {
                title: "Team Workspaces",
                desc: "Collaborate with role-based access, shared monitors, and team dashboards.",
              },
            ].map((item) => (
              <Card key={item.title} className="border bg-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0" />
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
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
            {alt.faqs.map((faq) => (
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
      <section className="py-20 px-4 bg-gradient-to-r from-indigo-600 via-teal-600 to-cyan-600 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Switch from {alt.name}?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Start with the free tier — no credit card required. Monitor Reddit
            in minutes and upgrade when you need more platforms.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=alt-${slug}`}>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 text-lg px-8"
              >
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-lg px-8 border-white/30 text-white hover:bg-white/10"
              >
                Compare Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Other Alternatives */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">
            More Alternatives
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {otherAlternatives.map((a) => (
              <Link key={a.slug} href={`/alternative/${a.slug}`}>
                <Badge
                  variant="outline"
                  className="text-base px-4 py-2 cursor-pointer hover:bg-muted transition-colors"
                >
                  vs {a.name}
                </Badge>
              </Link>
            ))}
            <Link href="/alternative">
              <Badge
                variant="outline"
                className="text-base px-4 py-2 cursor-pointer hover:bg-muted transition-colors"
              >
                View All
              </Badge>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
