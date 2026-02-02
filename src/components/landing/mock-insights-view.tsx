import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Minus, Lightbulb } from "lucide-react";
import { MOCK_INSIGHTS } from "./mock-data";
import { PlatformLogo } from "./platform-logos";

const platformIconColors: Record<string, string> = {
  reddit: "text-orange-500",
  hackernews: "text-amber-500",
  producthunt: "text-red-500",
  g2: "text-orange-600",
  trustpilot: "text-emerald-500",
  youtube: "text-red-600",
  quora: "text-red-500",
  github: "text-gray-400",
};

export function MockInsightsView() {
  return (
    <div className="p-4 space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/40 bg-card/50 p-3 text-center">
          <p className="text-lg font-bold text-foreground">8</p>
          <p className="text-[10px] text-muted-foreground">Discovered Topics</p>
        </Card>
        <Card className="border-border/40 bg-card/50 p-3 text-center">
          <p className="text-lg font-bold text-teal-400">5</p>
          <p className="text-[10px] text-muted-foreground">Rising Topics</p>
        </Card>
        <Card className="border-border/40 bg-card/50 p-3 text-center">
          <p className="text-lg font-bold text-foreground">42</p>
          <p className="text-[10px] text-muted-foreground">Total Mentions</p>
        </Card>
      </div>

      {/* Topic cards grid */}
      <div className="grid sm:grid-cols-2 gap-3">
        {MOCK_INSIGHTS.map((insight) => (
          <Card
            key={insight.topic}
            className="border-border/40 bg-card/50 p-4 space-y-2.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-teal-400" />
                <span className="text-sm font-medium">{insight.topic}</span>
              </div>
              {insight.trend === "up" ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <Minus className="h-4 w-4 text-gray-400" />
              )}
            </div>

            {/* Mentions + platforms */}
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] border-0 px-2 py-0.5 bg-muted/60 text-muted-foreground">
                {insight.mentions} mentions
              </Badge>
              <div className="flex gap-1.5 items-center">
                {insight.platforms.map((p) => (
                  <span
                    key={p}
                    className={platformIconColors[p] ?? "text-gray-400"}
                    title={p}
                  >
                    <PlatformLogo platform={p} className="h-3 w-3" />
                  </span>
                ))}
              </div>
            </div>

            {/* Sentiment breakdown */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-emerald-400">
                +{insight.sentimentPositive}
              </span>
              <span className="text-red-400">
                -{insight.sentimentNegative}
              </span>
              <span className="text-gray-400">
                ~{insight.sentimentNeutral}
              </span>
            </div>

            {/* Keywords */}
            <div className="flex flex-wrap gap-1">
              {insight.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground"
                >
                  {kw}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
