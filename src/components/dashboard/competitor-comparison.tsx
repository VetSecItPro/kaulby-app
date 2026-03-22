"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Swords,
  Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandStats {
  monitorId: string;
  brandName: string;
  isYourBrand: boolean;
  totalMentions: number;
  positive: number;
  neutral: number;
  negative: number;
  avgEngagement: number;
  topPlatform: string | null;
  thisWeekMentions: number;
  lastWeekMentions: number;
  trend: "up" | "down" | "flat";
  trendPercent: number;
}

interface CompetitorResponse {
  brands: BrandStats[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
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
  amazonreviews: "Amazon",
  indiehackers: "Indie Hackers",
  github: "GitHub",
  hashnode: "Hashnode",
  x: "X",
};

function formatPlatform(platform: string | null): string {
  if (!platform) return "N/A";
  return PLATFORM_LABELS[platform] || platform;
}

function sentimentPercent(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function TrendIndicator({ trend, percent }: { trend: "up" | "down" | "flat"; percent: number }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-green-400 text-sm font-medium">
        <ArrowUpRight className="h-4 w-4" />
        +{percent}%
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-sm font-medium">
        <ArrowDownRight className="h-4 w-4" />
        {percent}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-sm font-medium">
      <Minus className="h-4 w-4" />
      0%
    </span>
  );
}

function SentimentBar({ positive, neutral, negative, total }: {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}) {
  const posPct = sentimentPercent(positive, total);
  const neuPct = sentimentPercent(neutral, total);
  const negPct = sentimentPercent(negative, total);

  if (total === 0) {
    return <div className="h-2 w-full rounded-full bg-muted" />;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {posPct > 0 && (
          <div
            className="bg-green-400 transition-all duration-500"
            style={{ width: `${posPct}%` }}
          />
        )}
        {neuPct > 0 && (
          <div
            className="bg-yellow-400/60 transition-all duration-500"
            style={{ width: `${neuPct}%` }}
          />
        )}
        {negPct > 0 && (
          <div
            className="bg-red-400 transition-all duration-500"
            style={{ width: `${negPct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="text-green-400">{posPct}% pos</span>
        <span className="text-yellow-400/80">{neuPct}% neu</span>
        <span className="text-red-400">{negPct}% neg</span>
      </div>
    </div>
  );
}

function MentionBar({ mentions, maxMentions, isYourBrand }: {
  mentions: number;
  maxMentions: number;
  isYourBrand: boolean;
}) {
  const width = maxMentions > 0 ? Math.max(2, (mentions / maxMentions) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isYourBrand ? "bg-primary" : "bg-muted-foreground/40"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-sm font-mono font-medium w-12 text-right tabular-nums">
        {mentions}
      </span>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ComparisonSkeleton() {
  return (
    <div className="space-y-6">
      {/* Bar chart skeleton */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="animate-pulse h-5 w-40 bg-muted rounded mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="animate-pulse h-4 w-24 bg-muted rounded" />
              <div className="flex-1 animate-pulse h-3 bg-muted rounded-full" />
              <div className="animate-pulse h-4 w-10 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="animate-pulse h-10 bg-muted/50" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-t border-border">
            <div className="animate-pulse h-4 w-24 bg-muted rounded" />
            <div className="animate-pulse h-4 w-12 bg-muted rounded" />
            <div className="flex-1 animate-pulse h-2 bg-muted rounded-full" />
            <div className="animate-pulse h-4 w-16 bg-muted rounded" />
            <div className="animate-pulse h-4 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-muted-foreground/25 rounded-lg">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Add competitor monitors</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Create at least two monitors to compare brands. Your first monitor is treated as your own
        brand, and additional monitors represent competitors.
      </p>
      <Link
        href="/dashboard/monitors"
        className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Manage Monitors
      </Link>
    </div>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────────────

function BrandCard({ brand, maxMentions }: { brand: BrandStats; maxMentions: number }) {
  const total = brand.positive + brand.neutral + brand.negative;

  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-4 ${
        brand.isYourBrand
          ? "border-primary/50 ring-1 ring-primary/20"
          : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{brand.brandName}</h3>
          {brand.isYourBrand && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              You
            </span>
          )}
        </div>
        <TrendIndicator trend={brand.trend} percent={brand.trendPercent} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-lg font-bold tabular-nums">{brand.totalMentions}</div>
          <div className="text-xs text-muted-foreground">Mentions</div>
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums">{brand.avgEngagement}</div>
          <div className="text-xs text-muted-foreground">Avg Engagement</div>
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums">{formatPlatform(brand.topPlatform)}</div>
          <div className="text-xs text-muted-foreground">Top Platform</div>
        </div>
      </div>

      <MentionBar
        mentions={brand.totalMentions}
        maxMentions={maxMentions}
        isYourBrand={brand.isYourBrand}
      />

      <SentimentBar
        positive={brand.positive}
        neutral={brand.neutral}
        negative={brand.negative}
        total={total}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CompetitorComparison() {
  const [data, setData] = useState<CompetitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/competitor");
        if (!res.ok) {
          throw new Error("Failed to fetch competitor data");
        }
        const json: CompetitorResponse = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <ComparisonSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.brands.length < 2) {
    return <EmptyState />;
  }

  const maxMentions = Math.max(...data.brands.map((b) => b.totalMentions), 1);
  const yourBrand = data.brands.find((b) => b.isYourBrand);
  const competitors = data.brands.filter((b) => !b.isYourBrand);

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Swords className="h-4 w-4" />
            Brands Tracked
          </div>
          <div className="text-2xl font-bold">{data.brands.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-muted-foreground text-sm mb-1">Your Mentions (30d)</div>
          <div className="text-2xl font-bold">{yourBrand?.totalMentions ?? 0}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-muted-foreground text-sm mb-1">Competitor Avg (30d)</div>
          <div className="text-2xl font-bold">
            {competitors.length > 0
              ? Math.round(
                  competitors.reduce((sum, c) => sum + c.totalMentions, 0) / competitors.length
                )
              : 0}
          </div>
        </div>
      </div>

      {/* Mention volume comparison - bar chart */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
          Mention Volume (30 days)
        </h2>
        <div className="space-y-3">
          {data.brands.map((brand) => (
            <div key={brand.monitorId} className="flex items-center gap-4">
              <div className="flex items-center gap-2 w-32 shrink-0">
                <span
                  className={`text-sm font-medium truncate ${
                    brand.isYourBrand ? "text-primary" : "text-foreground"
                  }`}
                >
                  {brand.brandName}
                </span>
                {brand.isYourBrand && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1 py-0.5 rounded shrink-0">
                    You
                  </span>
                )}
              </div>
              <MentionBar
                mentions={brand.totalMentions}
                maxMentions={maxMentions}
                isYourBrand={brand.isYourBrand}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Brand
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Mentions
                </th>
                <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 min-w-[180px]">
                  Sentiment
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Positive %
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Negative %
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Avg Engagement
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Top Platform
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Trend (WoW)
                </th>
              </tr>
            </thead>
            <tbody>
              {data.brands.map((brand) => {
                const total = brand.positive + brand.neutral + brand.negative;
                const posPct = sentimentPercent(brand.positive, total);
                const negPct = sentimentPercent(brand.negative, total);

                return (
                  <tr
                    key={brand.monitorId}
                    className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                      brand.isYourBrand ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {brand.isYourBrand && (
                          <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
                        )}
                        <span className="font-medium text-sm">{brand.brandName}</span>
                        {brand.isYourBrand && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono font-semibold text-sm tabular-nums">
                        {brand.totalMentions}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SentimentBar
                        positive={brand.positive}
                        neutral={brand.neutral}
                        negative={brand.negative}
                        total={total}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono tabular-nums text-green-400">
                        {posPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono tabular-nums text-red-400">
                        {negPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm tabular-nums">{brand.avgEngagement}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{formatPlatform(brand.topPlatform)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TrendIndicator trend={brand.trend} percent={brand.trendPercent} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {data.brands.map((brand) => (
          <BrandCard key={brand.monitorId} brand={brand} maxMentions={maxMentions} />
        ))}
      </div>
    </div>
  );
}
