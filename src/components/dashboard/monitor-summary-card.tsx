"use client";

import { useState } from "react";
import { Wand2, RefreshCw, Loader2, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MonitorSummaryResponse {
  takeaways: string[];
  sentiment: { positive: number; negative: number; neutral: number };
  topPlatform: string | null;
  resultCount: number;
  rangeDays: number;
}

interface MonitorSummaryCardProps {
  monitorId: string;
  monitorName: string;
}

/**
 * Top-of-page summary card on /dashboard/monitors/[id]. Lazy fetches an
 * AI-generated 3-takeaway brief on click — not on mount, since each fetch
 * has real cost. Once generated, persists in component state for the
 * duration of the page session.
 */
export function MonitorSummaryCard({ monitorId, monitorName }: MonitorSummaryCardProps) {
  const [data, setData] = useState<MonitorSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/monitor-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId, rangeDays: 7 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData((await res.json()) as MonitorSummaryResponse);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate summary");
    } finally {
      setLoading(false);
    }
  }

  // Empty / not-yet-clicked state — single line CTA to keep the page tight
  // until the user actively asks for a brief.
  if (!data && !loading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 py-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">AI summary</CardTitle>
            <CardDescription className="text-xs">
              Top 3 takeaways from the last 7 days
            </CardDescription>
          </div>
          <Button size="sm" onClick={generate} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Generate
          </Button>
        </CardHeader>
      </Card>
    );
  }

  if (loading && !data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <CardTitle className="text-sm font-medium">Reading the last 7 days...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!data) return null;

  const totalSentiment = data.sentiment.positive + data.sentiment.negative + data.sentiment.neutral;
  const dominantSentiment =
    data.sentiment.positive >= data.sentiment.negative && data.sentiment.positive >= data.sentiment.neutral
      ? "positive"
      : data.sentiment.negative >= data.sentiment.neutral
        ? "negative"
        : "neutral";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            What changed for {monitorName} this week
          </CardTitle>
          <CardDescription className="text-xs mt-1 flex items-center gap-3 flex-wrap">
            <span>{data.resultCount} mentions, last {data.rangeDays}d</span>
            <span className="flex items-center gap-1">
              {dominantSentiment === "positive" && <ThumbsUp className="h-3 w-3 text-green-500" />}
              {dominantSentiment === "negative" && <ThumbsDown className="h-3 w-3 text-red-500" />}
              {dominantSentiment === "neutral" && <Minus className="h-3 w-3 text-gray-500" />}
              {data.sentiment.positive}/{data.sentiment.negative}/{data.sentiment.neutral} pos/neg/neu
            </span>
            {data.topPlatform && (
              <Badge variant="outline" className="text-[10px] py-0">
                top: {data.topPlatform}
              </Badge>
            )}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={generate}
          disabled={loading}
          className="h-7 px-2 gap-1 text-xs"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {data.takeaways.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No takeaways generated. Try refreshing or check back after the next scan.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {data.takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 mt-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
