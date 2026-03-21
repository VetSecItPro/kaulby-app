import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kaulby Demo — Interactive Dashboard Preview",
  description:
    "Explore Kaulby's AI-powered community monitoring dashboard with sample data. See how brand mentions, sentiment analysis, and lead scoring work across 17 platforms.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
