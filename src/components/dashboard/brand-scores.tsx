"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface ScoreData {
  presenceScore: number;
  presenceExplanation: string;
  presenceTrend: "up" | "down" | "stable";
  reputationScore: number;
  reputationExplanation: string;
  reputationTrend: "up" | "down" | "stable";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-teal-400";
  if (score >= 60) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function getScoreStrokeColor(score: number): string {
  if (score >= 80) return "stroke-teal-400";
  if (score >= 60) return "stroke-green-400";
  if (score >= 40) return "stroke-yellow-400";
  return "stroke-red-400";
}

function getScoreTrackColor(score: number): string {
  if (score >= 80) return "stroke-teal-400/15";
  if (score >= 60) return "stroke-green-400/15";
  if (score >= 40) return "stroke-yellow-400/15";
  return "stroke-red-400/15";
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <ArrowUpRight className="h-4 w-4 text-green-400" />;
  }
  if (trend === "down") {
    return <ArrowDownRight className="h-4 w-4 text-red-400" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function getTrendLabel(trend: "up" | "down" | "stable"): string {
  if (trend === "up") return "Trending up";
  if (trend === "down") return "Trending down";
  return "Stable";
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className={getScoreTrackColor(score)}
      />
      {/* Score arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={`${getScoreStrokeColor(score)} transition-all duration-700 ease-out`}
      />
    </svg>
  );
}

function ScoreCard({
  label,
  score,
  trend,
  explanation,
}: {
  label: string;
  score: number;
  trend: "up" | "down" | "stable";
  explanation: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
            <div className="flex items-center gap-1">
              <TrendIcon trend={trend} />
              <span className="text-xs text-muted-foreground">{getTrendLabel(trend)}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{explanation}</p>
        </div>
        <div className="relative flex-shrink-0">
          <ScoreRing score={score} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="animate-pulse h-4 w-32 bg-muted rounded" />
          <div className="animate-pulse h-3 w-full bg-muted rounded mt-3" />
          <div className="animate-pulse h-3 w-2/3 bg-muted rounded" />
        </div>
        <div className="animate-pulse h-20 w-20 rounded-full bg-muted flex-shrink-0" />
      </div>
    </div>
  );
}

export function BrandScores() {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchScores() {
      try {
        const res = await fetch("/api/dashboard/scores");
        if (!res.ok) throw new Error("Failed to fetch scores");
        const json = await res.json();
        setData(json);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchScores();
  }, []);

  if (error) return null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScoreCardSkeleton />
        <ScoreCardSkeleton />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ScoreCard
        label="Presence Score"
        score={data.presenceScore}
        trend={data.presenceTrend}
        explanation={data.presenceExplanation}
      />
      <ScoreCard
        label="Reputation Score"
        score={data.reputationScore}
        trend={data.reputationTrend}
        explanation={data.reputationExplanation}
      />
    </div>
  );
}
