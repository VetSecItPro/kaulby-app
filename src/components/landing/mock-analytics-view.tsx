import { Card } from "@/components/ui/card";
import {
  MOCK_ANALYTICS_DAILY,
  MOCK_PLATFORM_BREAKDOWN,
  MOCK_SENTIMENT_TOTALS,
} from "./mock-data";

const maxDaily = Math.max(...MOCK_ANALYTICS_DAILY.map((d) => d.value));
const maxPlatform = Math.max(...MOCK_PLATFORM_BREAKDOWN.map((p) => p.count));

export function MockAnalyticsView() {
  const totalMentions = MOCK_PLATFORM_BREAKDOWN.reduce(
    (sum, p) => sum + p.count,
    0
  );
  const sentimentPct = Math.round(
    (MOCK_SENTIMENT_TOTALS.positive /
      (MOCK_SENTIMENT_TOTALS.positive +
        MOCK_SENTIMENT_TOTALS.negative +
        MOCK_SENTIMENT_TOTALS.neutral)) *
      100
  );
  const topPlatform = MOCK_PLATFORM_BREAKDOWN[0];
  const topCategory = "Pain Points";

  return (
    <div className="p-4 space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/40 bg-card/50 p-3">
          <p className="text-[10px] text-muted-foreground">Total Mentions</p>
          <p className="text-lg font-bold">{totalMentions}</p>
        </Card>
        <Card className="border-border/40 bg-card/50 p-3">
          <p className="text-[10px] text-muted-foreground">Sentiment</p>
          <p className="text-lg font-bold text-emerald-400">{sentimentPct}%</p>
        </Card>
        <Card className="border-border/40 bg-card/50 p-3">
          <p className="text-[10px] text-muted-foreground">Top Platform</p>
          <p className="text-lg font-bold">{topPlatform.platform}</p>
        </Card>
        <Card className="border-border/40 bg-card/50 p-3">
          <p className="text-[10px] text-muted-foreground">Top Category</p>
          <p className="text-lg font-bold">{topCategory}</p>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Bar chart - daily volume */}
        <Card className="border-border/40 bg-card/50 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Mentions by Day
          </p>
          <div className="flex items-end justify-between gap-2 h-32">
            {MOCK_ANALYTICS_DAILY.map((day) => (
              <div key={day.day} className="flex flex-col items-center gap-1 flex-1">
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

        {/* Horizontal bars - platform breakdown */}
        <Card className="border-border/40 bg-card/50 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            By Platform
          </p>
          <div className="space-y-2.5">
            {MOCK_PLATFORM_BREAKDOWN.map((p) => (
              <div key={p.platform} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{p.platform}</span>
                  <span className="font-medium">{p.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.color}`}
                    style={{
                      width: `${(p.count / maxPlatform) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
