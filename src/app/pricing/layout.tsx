import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pricing | Kaulby - AI-Powered Community Monitoring",
  description: "Simple, transparent pricing for AI-powered community monitoring. Free tier available. Monitor Reddit, Hacker News, and 15+ platforms.",
  openGraph: {
    title: "Pricing | Kaulby",
    description: "Simple, transparent pricing for AI-powered community monitoring. Free tier available.",
    url: "https://kaulbyapp.com/pricing",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
