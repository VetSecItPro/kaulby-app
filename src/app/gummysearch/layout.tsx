import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GummySearch Alternative - Kaulby | Reddit & Community Monitoring",
  description:
    "GummySearch is closing. Kaulby is the best alternative with 16 platforms (Reddit, Hacker News, Product Hunt, Google Reviews & more), AI sentiment analysis, and pain point detection. Migrate free today.",
  keywords: [
    "GummySearch alternative",
    "GummySearch replacement",
    "Reddit monitoring tool",
    "Reddit brand monitoring",
    "community monitoring",
    "social listening",
    "Reddit keyword tracker",
    "Reddit mention tracker",
    "brand mention monitoring",
    "sentiment analysis",
    "pain point detection",
    "competitor monitoring",
    "Reddit alerts",
    "Hacker News monitoring",
    "Product Hunt monitoring",
  ],
  openGraph: {
    title: "GummySearch Alternative - Kaulby",
    description:
      "GummySearch is closing. Migrate to Kaulby - monitor Reddit, HN, Product Hunt & 9 more platforms with AI-powered insights.",
    url: "https://kaulbyapp.com/gummysearch",
    siteName: "Kaulby",
    type: "website",
    images: [
      {
        url: "https://kaulbyapp.com/og-gummysearch.png",
        width: 1200,
        height: 630,
        alt: "Kaulby - GummySearch Alternative",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GummySearch Alternative - Kaulby",
    description:
      "GummySearch is closing. Migrate to Kaulby - 16 platforms, AI analysis, same features you loved.",
    images: ["https://kaulbyapp.com/og-gummysearch.png"],
  },
  alternates: {
    canonical: "https://kaulbyapp.com/gummysearch",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function GummySearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
