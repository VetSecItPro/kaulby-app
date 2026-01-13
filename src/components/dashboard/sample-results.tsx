"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  ThumbsUp,
  ExternalLink,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Sample results to show users what the product does
const SAMPLE_RESULTS = [
  {
    id: "sample-1",
    title: "Looking for project management tool recommendations",
    platform: "reddit",
    subreddit: "r/startups",
    author: "startup_founder_22",
    content: "We're a 10-person team and our current PM tool isn't scaling well. Looking for something that handles both tasks and time tracking...",
    sentiment: "neutral",
    painPoint: "Tool limitations",
    score: 127,
    comments: 45,
    timeAgo: "2 hours ago",
    aiSummary: "User is actively searching for a project management solution. Team size (10 people) suggests they may need a more robust tool. Good opportunity for outreach.",
  },
  {
    id: "sample-2",
    title: "Frustrated with [Competitor] - any alternatives?",
    platform: "hackernews",
    author: "techdev_mike",
    content: "Been using [Competitor] for 6 months and the support is terrible. Every update breaks something. Ready to switch...",
    sentiment: "negative",
    painPoint: "Poor support",
    score: 89,
    comments: 32,
    timeAgo: "4 hours ago",
    aiSummary: "High-intent user experiencing pain with competitor product. Explicitly asking for alternatives - ideal engagement opportunity.",
  },
  {
    id: "sample-3",
    title: "Show HN: Built a tool that monitors social mentions",
    platform: "hackernews",
    author: "builder_jane",
    content: "After struggling to track mentions of our product across Reddit and HN, I built this simple monitoring tool...",
    sentiment: "positive",
    painPoint: "Brand monitoring need",
    score: 234,
    comments: 78,
    timeAgo: "6 hours ago",
    aiSummary: "Competitor/alternative product launch. Good to monitor for market trends and positioning opportunities.",
  },
];

interface SampleResultsPreviewProps {
  className?: string;
}

export function SampleResultsPreview({ className }: SampleResultsPreviewProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Example Results Preview
          </h3>
          <p className="text-sm text-muted-foreground">
            Here's what your dashboard will look like with real data
          </p>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          Demo Data
        </Badge>
      </div>

      {/* Sample Results */}
      <div className="space-y-3">
        {SAMPLE_RESULTS.map((result) => (
          <SampleResultCard key={result.id} result={result} />
        ))}
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Ready to find real conversations?</p>
                <p className="text-sm text-muted-foreground">Create your first monitor and see actual results</p>
              </div>
            </div>
            <Link href="/dashboard/monitors/new">
              <Button className="gap-2 w-full sm:w-auto">
                Create Monitor
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SampleResultCardProps {
  result: typeof SAMPLE_RESULTS[0];
}

function SampleResultCard({ result }: SampleResultCardProps) {
  return (
    <Card className="relative overflow-hidden opacity-90 hover:opacity-100 transition-opacity">
      {/* Demo overlay indicator */}
      <div className="absolute top-0 right-0 bg-gradient-to-bl from-amber-100/80 to-transparent p-4">
        <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Sample</span>
      </div>

      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs capitalize">
                  {result.platform}
                </Badge>
                {result.subreddit && (
                  <span className="text-xs text-muted-foreground">{result.subreddit}</span>
                )}
                <span className="text-xs text-muted-foreground">{result.timeAgo}</span>
              </div>
              <h4 className="font-medium text-sm line-clamp-2">{result.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">by {result.author}</p>
            </div>
          </div>

          {/* Content */}
          <p className="text-sm text-muted-foreground line-clamp-2">{result.content}</p>

          {/* AI Analysis */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-primary">AI Analysis</span>
            </div>
            <p className="text-xs text-muted-foreground">{result.aiSummary}</p>
            <div className="flex items-center gap-3 mt-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  result.sentiment === "positive" && "bg-green-50 text-green-700 border-green-200",
                  result.sentiment === "negative" && "bg-red-50 text-red-700 border-red-200",
                  result.sentiment === "neutral" && "bg-gray-50 text-gray-700 border-gray-200"
                )}
              >
                {result.sentiment}
              </Badge>
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                {result.painPoint}
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {result.score}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {result.comments} comments
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for sidebar or smaller spaces
export function SampleResultsCompact() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Preview: What you'll see
      </p>
      <div className="space-y-2">
        {SAMPLE_RESULTS.slice(0, 2).map((result) => (
          <div
            key={result.id}
            className="rounded-lg border bg-card p-2 space-y-1 opacity-75"
          >
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                {result.platform}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{result.timeAgo}</span>
            </div>
            <p className="text-xs font-medium line-clamp-1">{result.title}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-1">{result.aiSummary}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        This is sample data. Create a monitor to see real results.
      </p>
    </div>
  );
}
