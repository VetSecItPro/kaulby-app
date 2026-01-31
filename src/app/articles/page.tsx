import { Metadata } from "next";
import { MarketingHeader } from "@/components/shared/marketing-header";
import { MarketingFooter } from "@/components/shared/marketing-footer";
import { WebPageSchema } from "@/lib/seo/structured-data";
import { blogArticles, getFeaturedArticles } from "@/lib/data/blog-articles";
import { ArticlesPageClient } from "./ArticlesPageClient";

export const metadata: Metadata = {
  title: "Articles | Kaulby - Community Monitoring Insights",
  description:
    "Guides, strategies, and best practices for community monitoring, brand tracking, sentiment analysis, and community-led growth.",
  openGraph: {
    title: "Articles | Kaulby",
    description:
      "Guides, strategies, and best practices for community monitoring, brand tracking, sentiment analysis, and community-led growth.",
    url: "https://kaulbyapp.com/articles",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/articles",
  },
};

export default function ArticlesPage() {
  const featuredArticles = getFeaturedArticles();

  return (
    <div className="flex flex-col min-h-screen">
      <WebPageSchema
        title="Articles | Kaulby"
        description="Guides, strategies, and best practices for community monitoring, brand tracking, sentiment analysis, and community-led growth."
        url="https://kaulbyapp.com/articles"
        breadcrumbs={[
          { name: "Home", url: "https://kaulbyapp.com" },
          { name: "Articles", url: "https://kaulbyapp.com/articles" },
        ]}
      />

      <MarketingHeader />
      <main className="flex-1">
        <ArticlesPageClient
          articles={blogArticles}
          featuredArticles={featuredArticles}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
