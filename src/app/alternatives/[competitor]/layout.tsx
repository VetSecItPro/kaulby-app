import type { Metadata } from "next";

// Competitor metadata for SEO
const competitorMeta: Record<string, { name: string; description: string }> = {
  mention: {
    name: "Mention",
    description: "Looking for a Mention alternative? Kaulby offers better Reddit coverage, AI sentiment analysis, pain point detection, and a free tier. Compare features and pricing.",
  },
  brand24: {
    name: "Brand24",
    description: "Compare Kaulby vs Brand24 for community monitoring. Kaulby offers 9 platforms, AI-powered insights, and startup-friendly pricing starting at $0.",
  },
  brandwatch: {
    name: "Brandwatch",
    description: "Need a Brandwatch alternative for startups? Kaulby offers enterprise-level features with startup-friendly pricing. Self-serve signup, no sales calls required.",
  },
  hootsuite: {
    name: "Hootsuite",
    description: "Compare Kaulby vs Hootsuite for community monitoring. Kaulby is purpose-built for Reddit and developer communities with AI-powered insights.",
  },
  sproutsocial: {
    name: "Sprout Social",
    description: "Looking for a Sprout Social alternative? Kaulby offers dedicated community monitoring with 9 platforms, AI analysis, and pricing that starts at $0.",
  },
  awario: {
    name: "Awario",
    description: "Compare Kaulby vs Awario for social listening. Kaulby offers better Reddit coverage, developer platform monitoring, and a generous free tier.",
  },
};

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ competitor: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { competitor } = await params;
  const meta = competitorMeta[competitor] || {
    name: competitor.charAt(0).toUpperCase() + competitor.slice(1),
    description: `Compare Kaulby vs ${competitor} for community monitoring. Kaulby offers 9 platforms, AI-powered insights, and a free tier.`,
  };

  return {
    title: `Kaulby vs ${meta.name} - Best ${meta.name} Alternative | Community Monitoring`,
    description: meta.description,
    keywords: [
      `${meta.name} alternative`,
      `${meta.name} competitor`,
      `Kaulby vs ${meta.name}`,
      `${meta.name} replacement`,
      "Reddit monitoring tool",
      "community monitoring",
      "social listening alternative",
      "brand monitoring tool",
      "sentiment analysis tool",
    ],
    openGraph: {
      title: `Kaulby vs ${meta.name} - Feature Comparison`,
      description: meta.description,
      url: `https://kaulbyapp.com/alternatives/${competitor}`,
      siteName: "Kaulby",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Kaulby vs ${meta.name} | Best Alternative`,
      description: meta.description,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/alternatives/${competitor}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function AlternativeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
