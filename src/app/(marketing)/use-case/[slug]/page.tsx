import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle2,
  Target,
  Lightbulb,
  TrendingUp,
  Shield,
  Search,
  BarChart3,
  Users,
  MessageSquare,
} from "lucide-react";
import { USE_CASE_BY_SLUG, ALL_USE_CASE_SLUGS, USE_CASES } from "@/lib/data/use-cases";
import { FAQSchema, ToolPageSchema } from "@/lib/seo/structured-data";

// ISR: Revalidate every 24 hours
export const revalidate = 86400;

export async function generateStaticParams() {
  return ALL_USE_CASE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const useCase = USE_CASE_BY_SLUG[slug];

  if (!useCase) {
    return { title: "Use Case Not Found | Kaulby" };
  }

  const title = `${useCase.title} | Kaulby`;

  return {
    title,
    description: useCase.metaDescription,
    keywords: [
      useCase.title.toLowerCase(),
      slug.replace(/-/g, " "),
      "community monitoring",
      "brand monitoring",
      "social listening",
      "AI analysis",
    ],
    openGraph: {
      title,
      description: useCase.metaDescription,
      type: "website",
      url: `https://kaulbyapp.com/use-case/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: useCase.metaDescription,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/use-case/${slug}`,
    },
  };
}

const featureIcons = [Target, Lightbulb, TrendingUp, Shield, Search, BarChart3, Users, MessageSquare];

export default async function UseCasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const useCase = USE_CASE_BY_SLUG[slug];

  if (!useCase) {
    notFound();
  }

  // Get other use cases for cross-linking
  const otherUseCases = USE_CASES.filter((uc) => uc.slug !== slug).slice(0, 6);

  return (
    <>
      {/* Structured Data */}
      <ToolPageSchema
        name={`${useCase.title} - Kaulby`}
        description={useCase.metaDescription}
        url={`https://kaulbyapp.com/use-case/${slug}`}
        features={useCase.features.map((f) => f.title)}
      />
      <FAQSchema faqs={useCase.faqs} />

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            Use Case
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            {useCase.headline}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {useCase.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/sign-up?ref=usecase-${slug}`}>
              <Button size="lg" className="gap-2 text-lg px-8">
                Get Started Free
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

      {/* Features Grid */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            How Kaulby Helps With {useCase.title}
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Purpose-built features for {useCase.title.toLowerCase()}.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {useCase.features.map((feature, index) => {
              const Icon = featureIcons[index % featureIcons.length];
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

      {/* Relevant Platforms */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-4">
            Best Platforms for {useCase.title}
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            These platforms are most valuable for {useCase.title.toLowerCase()}.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {useCase.relevantPlatforms.map((platform) => (
              <Badge key={platform} variant="outline" className="text-base px-4 py-2">
                {platform}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Choose Kaulby for {useCase.title}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {useCase.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 p-4 rounded-lg bg-background border">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-base">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Keywords */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-4">
            Example Keywords to Track
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            Get started with these keyword ideas for {useCase.title.toLowerCase()}.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {useCase.exampleKeywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="text-base px-4 py-2">
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
            {useCase.faqs.map((faq) => (
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
            Start {useCase.title} Today
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Join businesses using Kaulby for {useCase.title.toLowerCase()} across 16 platforms.
          </p>
          <Link href={`/sign-up?ref=usecase-${slug}`}>
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Other Use Cases */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-8">
            Explore Other Use Cases
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherUseCases.map((uc) => (
              <Link key={uc.slug} href={`/use-case/${uc.slug}`}>
                <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{uc.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-2">
                      {uc.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
