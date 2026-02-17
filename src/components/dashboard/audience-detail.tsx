"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Radio,
  Pencil,
  ExternalLink,
  X,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
} from "lucide-react";
import { ExportDialog } from "./export-dialog";
import { getPlatformDisplayName, getPlatformBadgeColor, getPlatformBarColor } from "@/lib/platform-utils";
import type { Audience, Monitor, Result } from "@/lib/db/schema";

/**
 * Detailed stats for audience detail page
 */
export interface AudienceDetailStats {
  totalMentions: number;
  mentionChange: number;
  dailyMentions: number[];
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  platformBreakdown: Record<string, {
    count: number;
    sentiment: { positive: number; neutral: number; negative: number };
  }>;
  avgEngagement: number;
  totalAllTime: number;
}

interface AudienceDetailProps {
  audience: Audience;
  monitors: Monitor[];
  results: Result[];
  availableMonitors: Monitor[];
  stats?: AudienceDetailStats;
  /** Whether user has export access (Pro+) */
  hasExportAccess?: boolean;
}

/**
 * Platform breakdown card component
 */
function PlatformBreakdownCard({
  platform,
  count,
  sentiment,
  totalMentions,
}: {
  platform: string;
  count: number;
  sentiment: { positive: number; neutral: number; negative: number };
  totalMentions: number;
}) {
  const percentage = totalMentions > 0 ? (count / totalMentions) * 100 : 0;
  const sentimentTotal = sentiment.positive + sentiment.neutral + sentiment.negative;
  const positivePercent = sentimentTotal > 0 ? (sentiment.positive / sentimentTotal) * 100 : 0;

  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <Badge
          variant="secondary"
          className={`${getPlatformBadgeColor(platform, "light")}`}
        >
          {getPlatformDisplayName(platform)}
        </Badge>
        <span className="text-sm font-medium">{count}</span>
      </div>
      {/* Percentage bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-1">
        <div
          className={`h-full ${getPlatformBarColor(platform)} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{percentage.toFixed(0)}% of mentions</span>
        <span className="text-green-600 dark:text-green-400">
          {positivePercent.toFixed(0)}% positive
        </span>
      </div>
    </div>
  );
}

/**
 * Sentiment donut chart (simple SVG)
 */
function SentimentDonut({
  positive,
  neutral,
  negative,
  size = 80,
}: {
  positive: number;
  neutral: number;
  negative: number;
  size?: number;
}) {
  const total = positive + neutral + negative;
  if (total === 0) {
    return (
      <div
        className="rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;

  const positiveAngle = (positive / total) * circumference;
  const neutralAngle = (neutral / total) * circumference;
  const negativeAngle = (negative / total) * circumference;

  let offset = 0;
  const segments = [
    { color: "hsl(var(--success))", length: positiveAngle, label: "positive" },
    { color: "hsl(var(--muted-foreground))", length: neutralAngle, label: "neutral" },
    { color: "hsl(var(--destructive))", length: negativeAngle, label: "negative" },
  ].filter(s => s.length > 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((segment) => {
        const currentOffset = offset;
        offset += segment.length;
        return (
          <circle
            key={segment.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={12}
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            strokeDashoffset={-currentOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="round"
          />
        );
      })}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground text-lg font-bold"
      >
        {total}
      </text>
    </svg>
  );
}

export function AudienceDetail({
  audience,
  monitors,
  results,
  availableMonitors,
  stats,
  hasExportAccess = false,
}: AudienceDetailProps) {
  const router = useRouter();
  const [isAddingMonitor, setIsAddingMonitor] = useState(false);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>("");
  const [removeMonitorId, setRemoveMonitorId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleAddMonitor = async () => {
    if (!selectedMonitorId) return;
    setIsAddingMonitor(true);
    try {
      const response = await fetch(`/api/audiences/${audience.id}/monitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId: selectedMonitorId }),
      });
      if (response.ok) {
        setSelectedMonitorId("");
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to add monitor:", error);
    } finally {
      setIsAddingMonitor(false);
    }
  };

  const handleRemoveMonitor = async () => {
    if (!removeMonitorId) return;
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/audiences/${audience.id}/monitors`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId: removeMonitorId }),
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to remove monitor:", error);
    } finally {
      setIsRemoving(false);
      setRemoveMonitorId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/audiences">
            <Button variant="ghost" size="icon" aria-label="Back to audiences">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {audience.color && (
              <div
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: audience.color }}
              />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{audience.name}</h1>
              {audience.description && (
                <p className="text-muted-foreground">{audience.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog
            hasExportAccess={hasExportAccess}
            triggerLabel="Export"
          />
          <Link href={`/dashboard/audiences/${audience.id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Enhanced Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Mentions this week */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Mentions This Week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stats.totalMentions}</span>
                {stats.mentionChange !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${
                    stats.mentionChange > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    {stats.mentionChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(stats.mentionChange)}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sentiment breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Sentiment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <SentimentDonut
                  positive={stats.sentiment.positive}
                  neutral={stats.sentiment.neutral}
                  negative={stats.sentiment.negative}
                />
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>{stats.sentiment.positive} positive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>{stats.sentiment.neutral} neutral</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>{stats.sentiment.negative} negative</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Engagement */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Avg Engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgEngagement}</div>
              <p className="text-xs text-muted-foreground mt-1">
                upvotes + comments
              </p>
            </CardContent>
          </Card>

          {/* Monitors */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Radio className="h-3 w-3" />
                Active Monitors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{monitors.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalAllTime} mentions all time
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Platform Breakdown */}
      {stats && Object.keys(stats.platformBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Platform Breakdown
            </CardTitle>
            <CardDescription>
              Where conversations are happening this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stats.platformBreakdown)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([platform, data]) => (
                  <PlatformBreakdownCard
                    key={platform}
                    platform={platform}
                    count={data.count}
                    sentiment={data.sentiment}
                    totalMentions={stats.totalMentions}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback stats if no enhanced stats available */}
      {!stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Monitors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monitors.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Recent Results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{results.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Created</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDate(audience.createdAt)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monitors Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Monitors
              </CardTitle>
              <CardDescription>
                Monitors in this audience group.
              </CardDescription>
            </div>
            {availableMonitors.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedMonitorId}
                  onValueChange={setSelectedMonitorId}
                >
                  <SelectTrigger className="w-[200px]" aria-label="Select monitor to add">
                    <SelectValue placeholder="Select monitor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonitors.map((monitor) => (
                      <SelectItem key={monitor.id} value={monitor.id}>
                        {monitor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMonitor}
                  disabled={!selectedMonitorId || isAddingMonitor}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {monitors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No monitors in this audience yet.</p>
              <p className="text-sm">Add monitors to start tracking this segment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {monitors.map((monitor) => {
                const platformList = monitor.platforms || [];
                return (
                  <div
                    key={monitor.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          monitor.isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                        role="status"
                        aria-label={monitor.isActive ? "Active" : "Paused"}
                        title={monitor.isActive ? "Active" : "Paused"}
                      />
                      <div>
                        <div className="font-medium">{monitor.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {platformList.slice(0, 3).map((p) => (
                            <Badge key={p} variant="secondary" className={`text-xs ${getPlatformBadgeColor(p, "light")}`}>
                              {getPlatformDisplayName(p)}
                            </Badge>
                          ))}
                          {platformList.length > 3 && (
                            <span>+{platformList.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/monitors/${monitor.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`View monitor ${monitor.name}`}>
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveMonitorId(monitor.id)}
                        aria-label={`Remove monitor ${monitor.name} from audience`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Results
          </CardTitle>
          <CardDescription>
            Latest mentions from all monitors in this audience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No results yet.</p>
              <p className="text-sm">Results will appear here as monitors find mentions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.slice(0, 10).map((result) => {
                return (
                  <div
                    key={result.id}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium line-clamp-1">{result.title}</h4>
                      <Badge
                        variant="secondary"
                        className={getPlatformBadgeColor(result.platform, "light")}
                      >
                        {getPlatformDisplayName(result.platform)}
                      </Badge>
                    </div>
                    {result.content && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {result.content}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(result.createdAt)}</span>
                      {result.sourceUrl && (
                        <a
                          href={result.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {results.length > 10 && (
                <Link href="/dashboard/results">
                  <Button variant="outline" className="w-full">
                    View All Results
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove Monitor Dialog */}
      <AlertDialog open={!!removeMonitorId} onOpenChange={() => setRemoveMonitorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Monitor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this monitor from the audience? The
              monitor and its results will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMonitor} disabled={isRemoving}>
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
