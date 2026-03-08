import { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Status | Kaulby",
  description:
    "Real-time health and uptime status of all Kaulby services including database, cache, email, search, and background jobs.",
  openGraph: {
    title: "System Status | Kaulby",
    description:
      "Real-time health and uptime status of all Kaulby services.",
    url: "https://kaulbyapp.com/status",
  },
  alternates: {
    canonical: "https://kaulbyapp.com/status",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
