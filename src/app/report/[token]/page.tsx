/**
 * Public Shared Report Page
 *
 * Renders a branded, read-only report view accessible via share token.
 * No authentication required - this is a public page.
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, sharedReports } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import Link from "next/link";
import { sanitizeUrl } from "@/lib/security";

interface ReportTotals {
  mentions: number;
  positive: number;
  neutral: number;
  negative: number;
}

interface ReportPlatform {
  platform: string;
  mentions: number;
  engagement: number;
}

interface ReportPost {
  title: string;
  platform: string;
  sentiment: string;
  engagement: number;
  url: string;
  postedAt: string | null;
}

interface ReportData {
  totals: ReportTotals;
  platforms: ReportPlatform[];
  topPosts: ReportPost[];
}

// Generate metadata for SEO/sharing
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  const report = await db.query.sharedReports.findFirst({
    where: eq(sharedReports.shareToken, token),
    columns: { title: true, isActive: true },
  });

  if (!report || !report.isActive) {
    return { title: "Report Not Found - Kaulby" };
  }

  return {
    title: `${report.title} - Kaulby Report`,
    description: `Community monitoring report: ${report.title}`,
    robots: { index: false, follow: false }, // Don't index shared reports
  };
}

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Look up the report
  const report = await db.query.sharedReports.findFirst({
    where: eq(sharedReports.shareToken, token),
  });

  if (!report) {
    notFound();
  }

  // Check if active
  if (!report.isActive) {
    return <ReportDeactivated />;
  }

  // Check if expired
  if (report.expiresAt && new Date(report.expiresAt) < new Date()) {
    return <ReportExpired />;
  }

  // Increment view count (fire-and-forget)
  db.update(sharedReports)
    .set({ viewCount: sql`${sharedReports.viewCount} + 1` })
    .where(and(eq(sharedReports.id, report.id)))
    .execute()
    .catch(() => {
      // Non-critical - don't fail the page render
    });

  const data = report.reportData as unknown as ReportData;
  const totals = data.totals;
  const platforms = data.platforms || [];
  const topPosts = data.topPosts || [];

  const periodStart = new Date(report.periodStart).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const periodEnd = new Date(report.periodEnd).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const sentimentPercent = totals.mentions > 0
    ? Math.round((totals.positive / totals.mentions) * 100)
    : 0;

  const maxPlatformMentions = Math.max(...platforms.map((p) => p.mentions), 1);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-teal-400 font-semibold text-lg hover:text-teal-300 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-teal-400" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Kaulby
          </Link>
          <span className="text-xs text-zinc-500">Shared Report</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Title Section */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-zinc-50 sm:text-3xl">
            {report.title}
          </h1>
          <p className="text-sm text-zinc-400">
            {periodStart} &mdash; {periodEnd}
          </p>
        </div>

        {/* Summary Stats */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Mentions" value={totals.mentions} />
          <StatCard label="Positive" value={totals.positive} color="text-emerald-400" />
          <StatCard label="Neutral" value={totals.neutral} color="text-zinc-400" />
          <StatCard label="Negative" value={totals.negative} color="text-red-400" />
        </section>

        {/* Sentiment Bar */}
        {totals.mentions > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-200">Sentiment Breakdown</h2>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-800">
              {totals.positive > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(totals.positive / totals.mentions) * 100}%` }}
                  title={`Positive: ${totals.positive}`}
                />
              )}
              {totals.neutral > 0 && (
                <div
                  className="bg-zinc-500 transition-all"
                  style={{ width: `${(totals.neutral / totals.mentions) * 100}%` }}
                  title={`Neutral: ${totals.neutral}`}
                />
              )}
              {totals.negative > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(totals.negative / totals.mentions) * 100}%` }}
                  title={`Negative: ${totals.negative}`}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Positive ({sentimentPercent}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                Neutral ({totals.mentions > 0 ? Math.round((totals.neutral / totals.mentions) * 100) : 0}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Negative ({totals.mentions > 0 ? Math.round((totals.negative / totals.mentions) * 100) : 0}%)
              </span>
            </div>
          </section>
        )}

        {/* Platform Breakdown */}
        {platforms.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-200">Platform Breakdown</h2>
            <div className="space-y-2">
              {platforms.map((p) => (
                <div key={p.platform} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-zinc-300 capitalize">
                    {formatPlatformName(p.platform)}
                  </span>
                  <div className="flex-1 h-6 rounded bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-teal-500/80 rounded flex items-center justify-end px-2 text-xs font-medium text-white transition-all"
                      style={{ width: `${Math.max((p.mentions / maxPlatformMentions) * 100, 8)}%` }}
                    >
                      {p.mentions}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 w-24 text-right shrink-0">
                    {p.engagement.toLocaleString()} engagement
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Posts */}
        {topPosts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-200">Top Posts</h2>
            <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 overflow-hidden">
              {topPosts.map((post, i) => (
                <div key={i} className="px-4 py-3 hover:bg-zinc-900/50 transition-colors">
                  <a
                    href={sanitizeUrl(post.url) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-zinc-200 hover:text-teal-400 transition-colors line-clamp-2"
                  >
                    {post.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="capitalize">{formatPlatformName(post.platform)}</span>
                    <span className="text-zinc-700">&middot;</span>
                    <span className={sentimentColor(post.sentiment)}>
                      {post.sentiment}
                    </span>
                    <span className="text-zinc-700">&middot;</span>
                    <span>{post.engagement.toLocaleString()} engagement</span>
                    {post.postedAt && (
                      <>
                        <span className="text-zinc-700">&middot;</span>
                        <span>
                          {new Date(post.postedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {totals.mentions === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <p className="text-lg">No mentions found for this period.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-12">
        <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col items-center gap-2 text-center text-xs text-zinc-500">
          <p>
            Powered by{" "}
            <a
              href="https://kaulbyapp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 hover:text-teal-300 transition-colors"
            >
              Kaulby
            </a>{" "}
            &mdash; AI-powered community monitoring
          </p>
          <p>Report generated on {new Date(report.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
      </footer>
    </div>
  );
}

// -- Helper Components --

function StatCard({
  label,
  value,
  color = "text-zinc-50",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function ReportDeactivated() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold text-zinc-200">Report Unavailable</h1>
        <p className="text-zinc-400 text-sm max-w-md">
          This shared report has been deactivated by its owner.
        </p>
        <a
          href="https://kaulbyapp.com"
          className="inline-block mt-4 text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Learn about Kaulby
        </a>
      </div>
    </div>
  );
}

function ReportExpired() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold text-zinc-200">Report Expired</h1>
        <p className="text-zinc-400 text-sm max-w-md">
          This shared report link has expired. Contact the report owner for a new link.
        </p>
        <a
          href="https://kaulbyapp.com"
          className="inline-block mt-4 text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Learn about Kaulby
        </a>
      </div>
    </div>
  );
}

// -- Utility functions --

function formatPlatformName(platform: string): string {
  const names: Record<string, string> = {
    reddit: "Reddit",
    hackernews: "Hacker News",
    producthunt: "Product Hunt",
    devto: "Dev.to",
    googlereviews: "Google Reviews",
    trustpilot: "Trustpilot",
    appstore: "App Store",
    playstore: "Play Store",
    quora: "Quora",
    youtube: "YouTube",
    g2: "G2",
    yelp: "Yelp",
    amazonreviews: "Amazon Reviews",
    indiehackers: "Indie Hackers",
    github: "GitHub",
    hashnode: "Hashnode",
    x: "X (Twitter)",
  };
  return names[platform] || platform;
}

function sentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "positive":
      return "text-emerald-400";
    case "negative":
      return "text-red-400";
    default:
      return "text-zinc-400";
  }
}
