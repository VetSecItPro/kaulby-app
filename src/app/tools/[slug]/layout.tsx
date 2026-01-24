import type { Metadata } from "next";

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const titles: Record<string, string> = {
    "reddit-monitoring": "Reddit Monitoring Tool - Track Brand Mentions on Reddit | Kaulby",
    "social-listening-for-startups": "Social Listening for Startups - Affordable Brand Monitoring | Kaulby",
    "brand-monitoring": "Brand Monitoring Tool - Track Mentions Across 16 Platforms | Kaulby",
    "competitor-monitoring": "Competitor Monitoring Tool - Track Competitor Mentions | Kaulby",
  };

  const descriptions: Record<string, string> = {
    "reddit-monitoring": "Monitor Reddit for brand mentions, competitor insights, and customer feedback. AI-powered sentiment analysis and real-time alerts. Free tier available.",
    "social-listening-for-startups": "Affordable social listening for startups. Monitor 16 platforms including Reddit, Hacker News, and review sites. Start free, no credit card required.",
    "brand-monitoring": "Track every mention of your brand across Reddit, reviews, and communities. AI-powered sentiment analysis and instant alerts. Free to start.",
    "competitor-monitoring": "Monitor competitor mentions and customer sentiment. Track what customers say about alternatives. Find opportunities with AI-powered insights.",
  };

  const keywords: Record<string, string[]> = {
    "reddit-monitoring": ["reddit monitoring", "reddit alerts", "subreddit tracking", "reddit brand monitoring", "reddit keyword tracking"],
    "social-listening-for-startups": ["social listening for startups", "affordable social listening", "startup monitoring tool", "cheap brand monitoring"],
    "brand-monitoring": ["brand monitoring", "brand tracking", "online reputation monitoring", "brand mention tracking"],
    "competitor-monitoring": ["competitor monitoring", "competitor tracking", "competitive intelligence", "competitor analysis tool"],
  };

  return {
    title: titles[slug] || "Social Listening Tool | Kaulby",
    description: descriptions[slug] || "Monitor brand mentions across 16 platforms with AI-powered insights. Free tier available.",
    keywords: keywords[slug] || ["social listening", "brand monitoring"],
    openGraph: {
      title: titles[slug] || "Social Listening Tool | Kaulby",
      description: descriptions[slug] || "Monitor brand mentions across 16 platforms with AI-powered insights.",
      type: "website",
      url: `https://kaulbyapp.com/tools/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: titles[slug] || "Social Listening Tool | Kaulby",
      description: descriptions[slug] || "Monitor brand mentions across 16 platforms with AI-powered insights.",
    },
    alternates: {
      canonical: `https://kaulbyapp.com/tools/${slug}`,
    },
  };
}

export default function ToolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
