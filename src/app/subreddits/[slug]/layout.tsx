import type { Metadata } from "next";

// Subreddit metadata for SEO
const subredditMeta: Record<string, { name: string; description: string }> = {
  startups: {
    name: "r/startups",
    description: "Monitor r/startups discussions, track competitor mentions, and find customers in the largest startup community on Reddit with 1.2M+ members.",
  },
  saas: {
    name: "r/SaaS",
    description: "Track r/SaaS discussions about software tools, pricing strategies, and growth tactics. Find users looking for alternatives with AI-powered monitoring.",
  },
  entrepreneur: {
    name: "r/Entrepreneur",
    description: "Monitor r/Entrepreneur for business opportunities, brand mentions, and customer insights from 2.5M+ entrepreneurs and founders.",
  },
  smallbusiness: {
    name: "r/smallbusiness",
    description: "Track r/smallbusiness discussions to find small business owners looking for tools and solutions. Monitor competitors and gather market intelligence.",
  },
  webdev: {
    name: "r/webdev",
    description: "Monitor r/webdev for developer tool discussions, pain points, and technology trends. Track mentions across 1.8M+ web developers.",
  },
  programming: {
    name: "r/programming",
    description: "Track r/programming discussions about developer tools, languages, and best practices. Find users looking for solutions in 5.5M+ member community.",
  },
  marketing: {
    name: "r/marketing",
    description: "Monitor r/marketing for discussions about marketing tools, strategies, and competitor mentions. Find potential customers asking for solutions.",
  },
  socialmedia: {
    name: "r/socialmedia",
    description: "Track r/socialmedia discussions about social media tools, platform updates, and growth tactics. Monitor your niche and find customers.",
  },
  productivity: {
    name: "r/productivity",
    description: "Monitor r/productivity for tool recommendations, method discussions, and feature requests. Track 2M+ users looking for productivity solutions.",
  },
  sideproject: {
    name: "r/SideProject",
    description: "Track r/SideProject discussions from indie hackers and makers. Find early adopters and monitor your product niche.",
  },
};

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = subredditMeta[slug] || {
    name: `r/${slug}`,
    description: `Monitor r/${slug} with Kaulby - AI-powered Reddit monitoring for brand mentions, competitor tracking, and customer insights.`,
  };

  return {
    title: `Monitor ${meta.name} - Reddit Monitoring Tool | Kaulby`,
    description: meta.description,
    keywords: [
      `monitor ${meta.name}`,
      `${meta.name} monitoring`,
      `${meta.name} tracking`,
      "Reddit monitoring",
      "Reddit brand monitoring",
      "Reddit keyword tracking",
      "subreddit monitoring tool",
      "Reddit alerts",
      "social listening Reddit",
    ],
    openGraph: {
      title: `Monitor ${meta.name} with AI-Powered Insights | Kaulby`,
      description: meta.description,
      url: `https://kaulbyapp.com/subreddits/${slug}`,
      siteName: "Kaulby",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Monitor ${meta.name} | Kaulby`,
      description: meta.description,
    },
    alternates: {
      canonical: `https://kaulbyapp.com/subreddits/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function SubredditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
