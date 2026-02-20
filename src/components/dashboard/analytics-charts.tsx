"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { ShareOfVoice } from "./share-of-voice";
import { ReportGenerator } from "./report-generator";
import { EmptyState } from "./empty-states";

interface AnalyticsData {
  volumeOverTime: { date: string; count: number }[];
  sentimentOverTime: { date: string; positive: number; negative: number; neutral: number }[];
  categoryBreakdown: { category: string; count: number }[];
  platformBreakdown: { platform: string; count: number }[];
  totals: {
    mentions: number;
    positivePercent: number;
    negativePercent: number;
    neutralPercent: number;
    topPlatform: string | null;
    topCategory: string | null;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  solution_request: "hsl(var(--success))",
  money_talk: "hsl(var(--warning))",
  pain_point: "hsl(var(--destructive))",
  advice_request: "hsl(var(--info))",
  hot_discussion: "hsl(var(--chart-5))",
  uncategorized: "hsl(var(--muted-foreground))",
};

const CATEGORY_LABELS: Record<string, string> = {
  solution_request: "Solutions",
  money_talk: "Budget Talk",
  pain_point: "Pain Points",
  advice_request: "Advice",
  hot_discussion: "Trending",
  uncategorized: "General",
};

const PLATFORM_COLORS: Record<string, string> = {
  reddit: "hsl(var(--reddit))",
  hackernews: "hsl(var(--hackernews))",
  producthunt: "hsl(var(--producthunt))",
  devto: "hsl(var(--muted-foreground))",
  googlereviews: "hsl(var(--info))",
  trustpilot: "hsl(var(--success))",
  appstore: "hsl(var(--chart-4))",
  playstore: "hsl(var(--success))",
  quora: "hsl(var(--destructive))",
};

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
};

const SENTIMENT_COLORS = {
  positive: "hsl(var(--success))",
  negative: "hsl(var(--destructive))",
  neutral: "hsl(var(--muted-foreground))",
};

type TimeRange = "7d" | "30d" | "90d" | "1y";

interface ShareOfVoiceData {
  yourBrand: {
    name: string;
    mentions: number;
    previousMentions: number;
    sentiment: { positive: number; neutral: number; negative: number };
  } | null;
  competitors: Array<{
    name: string;
    mentions: number;
    previousMentions: number;
    sentiment: { positive: number; neutral: number; negative: number };
  }>;
  period: string;
}

interface AnalyticsChartsProps {
  subscriptionStatus?: string;
}

export function AnalyticsCharts({ subscriptionStatus = "free" }: AnalyticsChartsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("30d");
  const [sovData, setSovData] = useState<ShareOfVoiceData | null>(null);
  const [sovLoading, setSovLoading] = useState(false);

  const isTeam = subscriptionStatus === "enterprise";

  useEffect(() => {
    const controller = new AbortController();
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics?range=${range}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const analytics = await response.json();
          setData(analytics);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch analytics:", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchAnalytics();
    return () => controller.abort();
  }, [range]);

  // Fetch Share of Voice data for Team tier users
  useEffect(() => {
    if (!isTeam) return;
    const controller = new AbortController();
    async function fetchShareOfVoice() {
      setSovLoading(true);
      try {
        const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
        const response = await fetch(`/api/analytics/share-of-voice?days=${days}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const sovResult = await response.json();
          setSovData(sovResult);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch share of voice:", error);
      } finally {
        if (!controller.signal.aborted) setSovLoading(false);
      }
    }
    fetchShareOfVoice();
    return () => controller.abort();
  }, [range, isTeam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.totals.mentions === 0) {
    return (
      <EmptyState
        type="analytics"
        title="Your analytics will appear here after your first scan"
        description="Once your monitors start finding mentions, you'll see trends, sentiment breakdowns, and platform insights right here."
        actionLabel="Create a Monitor"
        actionHref="/dashboard/monitors/new"
      />
    );
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d", "1y"] as TimeRange[]).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r)}
            >
              {r === "7d" && "7 Days"}
              {r === "30d" && "30 Days"}
              {r === "90d" && "90 Days"}
              {r === "1y" && "1 Year"}
            </Button>
          ))}
        </div>
        <ReportGenerator
          isTeam={isTeam}
          onGenerate={async (config) => {
            const response = await fetch("/api/reports/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(config),
            });
            if (!response.ok) {
              throw new Error("Failed to generate report");
            }
            // For HTML reports, open in new tab
            const html = await response.text();
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            return url;
          }}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mentions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totals.mentions}</div>
            <p className="text-xs text-muted-foreground">
              in the last {range === "7d" ? "7 days" : range === "30d" ? "30 days" : range === "90d" ? "90 days" : "1 year"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sentiment</CardTitle>
            {data.totals.positivePercent > data.totals.negativePercent ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : data.totals.negativePercent > data.totals.positivePercent ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : (
              <Minus className="h-4 w-4 text-gray-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-semibold">{data.totals.positivePercent}%</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-600 font-semibold">{data.totals.negativePercent}%</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-gray-600 font-semibold">{data.totals.neutralPercent}%</span>
            </div>
            <p className="text-xs text-muted-foreground">positive / negative / neutral</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {data.totals.topPlatform || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">most active source</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
            {data.totals.topCategory === "solution_request" && <Target className="h-4 w-4 text-green-500" />}
            {data.totals.topCategory === "money_talk" && <DollarSign className="h-4 w-4 text-amber-500" />}
            {data.totals.topCategory === "pain_point" && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {data.totals.topCategory === "advice_request" && <HelpCircle className="h-4 w-4 text-blue-500" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totals.topCategory ? CATEGORY_LABELS[data.totals.topCategory] || data.totals.topCategory : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">most common type</p>
          </CardContent>
        </Card>
      </div>

      {/* Share of Voice - Team Tier Feature */}
      {isTeam ? (
        sovLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : sovData?.yourBrand ? (
          <ShareOfVoice
            yourBrand={sovData.yourBrand}
            competitors={sovData.competitors}
            period={sovData.period}
            showDetails={true}
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Share of Voice data will appear once you have multiple monitors tracking different brands.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-1">Share of Voice</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Compare your brand&apos;s mentions against competitors. See who dominates the conversation.
            </p>
            <Badge variant="outline">Team Plan Feature</Badge>
          </CardContent>
        </Card>
      )}

      {/* Volume Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Mention Volume</CardTitle>
          <CardDescription>Number of mentions over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.volumeOverTime}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                labelFormatter={formatDate}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--chart-5))"
                fill="hsl(var(--chart-5))"
                fillOpacity={0.2}
                name="Mentions"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sentiment Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Trends</CardTitle>
          <CardDescription>Sentiment breakdown over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.sentimentOverTime}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                labelFormatter={formatDate}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="positive"
                stackId="1"
                stroke={SENTIMENT_COLORS.positive}
                fill={SENTIMENT_COLORS.positive}
                fillOpacity={0.6}
                name="Positive"
              />
              <Area
                type="monotone"
                dataKey="neutral"
                stackId="1"
                stroke={SENTIMENT_COLORS.neutral}
                fill={SENTIMENT_COLORS.neutral}
                fillOpacity={0.6}
                name="Neutral"
              />
              <Area
                type="monotone"
                dataKey="negative"
                stackId="1"
                stroke={SENTIMENT_COLORS.negative}
                fill={SENTIMENT_COLORS.negative}
                fillOpacity={0.6}
                name="Negative"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category and Platform Breakdown */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Mentions by conversation type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.categoryBreakdown}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ category, percent }) =>
                    `${CATEGORY_LABELS[category] || category} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {data.categoryBreakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[entry.category] || "#6b7280"}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Breakdown</CardTitle>
            <CardDescription>Mentions by source</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.platformBreakdown} layout="vertical">
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  dataKey="platform"
                  type="category"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => PLATFORM_LABELS[value] || value}
                  width={110}
                />
                <Bar dataKey="count" name="Mentions">
                  {data.platformBreakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PLATFORM_COLORS[entry.platform] || "#6b7280"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
