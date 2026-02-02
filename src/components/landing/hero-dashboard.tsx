import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Minus,
  Lightbulb,
  MessageSquare,
  BarChart3,
  Radio,
} from "lucide-react";
import { BrowserFrame } from "./browser-frame";
import {
  MOCK_INSIGHTS,
  MOCK_ANALYTICS_DAILY,
  MOCK_SENTIMENT_TOTALS,
} from "./mock-data";
import { PlatformLogo } from "./platform-logos";
import { AnimatedSection } from "@/components/shared/home-animations-lazy";

const maxDaily = Math.max(...MOCK_ANALYTICS_DAILY.map((d) => d.value));

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

export function HeroDashboard() {
  const insights = MOCK_INSIGHTS.slice(0, 2);
  const sentimentTotal =
    MOCK_SENTIMENT_TOTALS.positive +
    MOCK_SENTIMENT_TOTALS.negative +
    MOCK_SENTIMENT_TOTALS.neutral;
  const sentimentPct = Math.round(
    (MOCK_SENTIMENT_TOTALS.positive / sentimentTotal) * 100
  );

  return (
    <AnimatedSection className="w-full max-w-5xl mx-auto">
      <div
        className="relative"
        style={{
          perspective: "1200px",
        }}
      >
        <div className="md:[transform:rotateX(2deg)] transition-transform duration-500">
          {/* Teal glow underneath */}
          <div className="absolute -inset-4 bg-teal-500/10 rounded-3xl blur-2xl -z-10" />

          <BrowserFrame>
            {/* Nav tabs */}
            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-4 overflow-x-auto">
              <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Mentions
              </span>
              <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-primary border-b-2 border-primary pb-0.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Overview
              </span>
              <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Radio className="h-3.5 w-3.5" />
                Monitors
              </span>
            </div>

            <div className="p-4 space-y-4 relative">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/40 bg-card/50 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    New Mentions
                  </p>
                  <p className="text-xl font-bold">42</p>
                  <p className="text-[10px] text-emerald-400">+18% this week</p>
                </Card>
                <Card className="border-border/40 bg-card/50 p-3">
                  <p className="text-[10px] text-muted-foreground">Sentiment</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {sentimentPct}%
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      positive
                    </span>
                  </p>
                </Card>
                <Card className="border-border/40 bg-card/50 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    Active Monitors
                  </p>
                  <p className="text-xl font-bold">3</p>
                  <p className="text-[10px] text-muted-foreground">
                    6 platforms tracked
                  </p>
                </Card>
                <Card className="border-border/40 bg-card/50 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    Hot Leads
                  </p>
                  <p className="text-xl font-bold text-amber-400">7</p>
                  <p className="text-[10px] text-muted-foreground">
                    score &gt; 70
                  </p>
                </Card>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Mini bar chart */}
                <Card className="border-border/40 bg-card/50 p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Mention Volume (7d)
                  </p>
                  <div className="flex items-end justify-between gap-2 h-24">
                    {MOCK_ANALYTICS_DAILY.map((day) => (
                      <div
                        key={day.day}
                        className="flex flex-col items-center gap-1 flex-1"
                      >
                        <div
                          className="w-full rounded-t bg-gradient-to-t from-teal-600 to-teal-400 min-h-[4px]"
                          style={{
                            height: `${(day.value / maxDaily) * 100}%`,
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {day.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Rising topics */}
                <Card className="border-border/40 bg-card/50 p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Rising Topics
                  </p>
                  <div className="space-y-3">
                    {insights.map((insight) => (
                      <div key={insight.topic} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Lightbulb className="h-3.5 w-3.5 text-teal-400" />
                            <span className="text-xs font-medium">
                              {insight.topic}
                            </span>
                          </div>
                          {insight.trend === "up" ? (
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Minus className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="text-[10px] border-0 px-2 py-0.5 bg-muted/60 text-muted-foreground">
                            {insight.mentions} mentions
                          </Badge>
                          <div className="flex gap-1.5 items-center">
                            {insight.platforms.map((p) => (
                              <span
                                key={p}
                                className={
                                  platformIconColors[p] ?? "text-gray-400"
                                }
                              >
                                <PlatformLogo
                                  platform={p}
                                  className="h-3 w-3"
                                />
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] ml-auto">
                            <span className="text-emerald-400">
                              +{insight.sentimentPositive}
                            </span>
                            <span className="text-red-400">
                              -{insight.sentimentNegative}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Gradient fade at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
            </div>
          </BrowserFrame>
        </div>
      </div>
    </AnimatedSection>
  );
}
