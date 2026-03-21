import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { ALTERNATIVES } from "@/lib/data/alternatives";

export const metadata: Metadata = {
  title: "Kaulby Alternatives & Comparisons | Community Monitoring",
  description:
    "Compare Kaulby to GummySearch, Mention, Brand24, Syften, F5Bot, and more. See why teams choose Kaulby for community monitoring across 17 platforms with AI analysis.",
  keywords: [
    "kaulby alternatives",
    "community monitoring comparison",
    "gummysearch alternative",
    "mention alternative",
    "brand24 alternative",
    "syften alternative",
    "f5bot alternative",
    "social listening comparison",
  ],
  openGraph: {
    title: "Kaulby Alternatives & Comparisons",
    description:
      "Compare Kaulby to the top community monitoring and social listening tools. Feature comparisons, pricing, and platform coverage.",
    type: "website",
    url: "https://kaulbyapp.com/alternative",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/alternative",
  },
};

export default function AlternativesIndexPage() {
  return (
    <>
      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            Comparisons
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Kaulby vs the{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Competition
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how Kaulby compares to popular community monitoring and social
            listening tools. We track 17 platforms with AI-powered analysis —
            starting free.
          </p>
        </div>
      </section>

      {/* Alternatives Grid */}
      <section className="py-12 px-4 pb-20">
        <div className="container mx-auto max-w-5xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ALTERNATIVES.map((alt) => (
              <Link key={alt.slug} href={`/alternative/${alt.slug}`}>
                <Card className="h-full border hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {alt.pricing}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      Kaulby vs {alt.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {alt.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {alt.platformList.slice(0, 4).map((platform) => (
                        <Badge
                          key={platform}
                          variant="secondary"
                          className="text-xs"
                        >
                          {platform}
                        </Badge>
                      ))}
                      {alt.platformList.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{alt.platformList.length - 4} more
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-medium text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                      Compare
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-indigo-600 via-teal-600 to-cyan-600 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Try Kaulby?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Start monitoring your community for free. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up?ref=alternatives">
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
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
