import Link from "next/link";
import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { TOOLS } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Monitoring Tools | Kaulby",
  description:
    "Free tools to monitor brand mentions, Reddit discussions, Google Reviews, competitor activity, buying signals, and customer pain points across 17 platforms.",
  keywords: [
    "free brand monitoring tools",
    "reddit monitor",
    "google reviews monitor",
    "competitor intelligence",
    "social listening tools",
    "brand mention tracker",
  ],
  openGraph: {
    title: "Free Monitoring Tools | Kaulby",
    description:
      "Free tools to monitor brand mentions, Reddit discussions, Google Reviews, competitor activity, buying signals, and customer pain points across 17 platforms.",
    type: "website",
    url: "https://kaulbyapp.com/tools",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/tools",
  },
};

export default function ToolsIndexPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-background to-teal-950/30" />
        <div className="container relative mx-auto max-w-4xl text-center">
          <Badge
            variant="secondary"
            className="mb-4 text-sm px-4 py-1 border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
          >
            Free Tools
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-indigo-200 to-cyan-200 bg-clip-text text-transparent">
            Monitoring Tools for Every Need
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Track brand mentions, monitor competitors, find buying signals, and
            discover customer pain points — all powered by AI across 17
            platforms.
          </p>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TOOLS.map((tool) => (
              <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                <Card className="h-full flex flex-col hover:bg-muted/50 hover:border-indigo-500/30 transition-colors cursor-pointer group">
                  <CardHeader className="flex-1">
                    <CardTitle className="text-lg group-hover:text-indigo-400 transition-colors">
                      {tool.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      {tool.description}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {tool.platforms.slice(0, 4).map((platform) => (
                        <Badge
                          key={platform}
                          variant="outline"
                          className="text-xs px-2 py-0.5 border-indigo-500/20 bg-indigo-500/5"
                        >
                          {platform}
                        </Badge>
                      ))}
                      {tool.platforms.length > 4 && (
                        <Badge
                          variant="outline"
                          className="text-xs px-2 py-0.5 border-muted-foreground/20"
                        >
                          +{tool.platforms.length - 4} more
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center text-sm text-indigo-400 group-hover:text-indigo-300 transition-colors">
                      Learn more
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-cyan-600 text-white">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Monitoring for Free
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Set up your first monitor in under 2 minutes. No credit card
            required.
          </p>
          <Link href="/sign-up?ref=tools">
            <Button size="lg" variant="secondary" className="gap-2 text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
