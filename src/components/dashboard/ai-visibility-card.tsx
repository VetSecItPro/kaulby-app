"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff, Bot, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompetitorEntry {
  name: string;
  count: number;
}

interface QueryResult {
  query: string;
  mentioned: boolean;
  position: string | null;
  context: string | null;
  competitors: string[];
  model: string;
  checkedAt: string;
}

interface BrandResult {
  brandName: string;
  monitorId: string;
  monitorName: string;
  score: number;
  totalQueries: number;
  mentionedCount: number;
  primaryCount: number;
  topCompetitors: CompetitorEntry[];
  queries: QueryResult[];
  lastChecked: string | null;
}

interface AIVisibilityData {
  overallScore: number;
  totalQueries: number;
  totalMentioned: number;
  brands: BrandResult[];
  lastChecked: string | null;
}

export function AIVisibilityCard({ className }: { className?: string }) {
  const [data, setData] = useState<AIVisibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/ai-visibility");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <AIVisibilityCardSkeleton className={className} />;
  }

  if (error || !data) {
    return (
      <Card className={cn("border-border/50", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-muted-foreground" />
            AI Visibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load AI visibility data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.totalQueries > 0;

  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-muted-foreground" />
            AI Visibility
          </CardTitle>
          {hasData && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-mono",
                data.overallScore >= 60
                  ? "border-green-500/50 text-green-400"
                  : data.overallScore >= 30
                    ? "border-yellow-500/50 text-yellow-400"
                    : "border-red-500/50 text-red-400"
              )}
            >
              {data.overallScore}%
            </Badge>
          )}
        </div>
        {data.lastChecked && (
          <CardDescription className="text-xs">
            Last checked{" "}
            {new Date(data.lastChecked).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            No AI visibility checks yet. Checks run weekly for Team tier users
            with monitors that have a company name set.
          </p>
        ) : (
          <>
            {/* Overall score bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Mentioned in {data.totalMentioned} of {data.totalQueries}{" "}
                  queries
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    data.overallScore >= 60
                      ? "bg-green-500"
                      : data.overallScore >= 30
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  )}
                  style={{ width: `${data.overallScore}%` }}
                />
              </div>
            </div>

            {/* Per-brand breakdown */}
            {data.brands.map((brand) => (
              <div key={`${brand.brandName}-${brand.monitorId}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {brand.brandName}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {brand.score}% visible
                  </span>
                </div>

                {/* Query results */}
                <div className="space-y-1 pl-1">
                  {brand.queries.slice(0, 5).map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs"
                    >
                      {q.mentioned ? (
                        <Eye className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "line-clamp-1",
                          q.mentioned
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {q.query}
                      </span>
                      {q.position === "primary" && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] px-1 py-0 border-green-500/50 text-green-400"
                        >
                          #1
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* Competitors */}
                {brand.topCompetitors.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pl-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      Also seen:
                    </span>
                    {brand.topCompetitors.slice(0, 3).map((c) => (
                      <Badge
                        key={c.name}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AIVisibilityCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-3 w-36 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </CardContent>
    </Card>
  );
}
