import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, ScanSearch, ArrowRight } from "lucide-react";
import { MOCK_MONITORS } from "./mock-data";
import { PlatformLogo } from "./platform-logos";

const platformBadgeColors: Record<string, string> = {
  reddit: "bg-orange-900/30 text-orange-400",
  hackernews: "bg-amber-900/30 text-amber-400",
  producthunt: "bg-red-900/30 text-red-400",
  g2: "bg-orange-900/30 text-orange-600",
  trustpilot: "bg-emerald-900/30 text-emerald-400",
  youtube: "bg-red-900/30 text-red-400",
  quora: "bg-red-900/30 text-red-600",
  github: "bg-gray-900/30 text-gray-300",
};

const platformLabels: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "HN",
  producthunt: "PH",
  g2: "G2",
  trustpilot: "Trustpilot",
  youtube: "YouTube",
  quora: "Quora",
  github: "GitHub",
};

export function MockMonitorsView() {
  return (
    <div className="p-4 space-y-3">
      {MOCK_MONITORS.map((monitor) => (
        <Card
          key={monitor.id}
          className="border-border/40 bg-card/50 p-4 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-medium">{monitor.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {monitor.newCount > 0 && (
                <Badge className="text-[10px] border-0 px-2 py-0.5 bg-teal-900/30 text-teal-400">
                  {monitor.newCount} new
                </Badge>
              )}
              <Badge className="text-[10px] border-0 px-2 py-0.5 bg-emerald-900/30 text-emerald-400">
                Active
              </Badge>
            </div>
          </div>

          {/* Keywords */}
          <div className="flex flex-wrap gap-1.5">
            {monitor.keywords.map((kw) => (
              <span
                key={kw}
                className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
              >
                {kw}
              </span>
            ))}
          </div>

          {/* Platforms */}
          <div className="flex flex-wrap gap-1.5">
            {monitor.platforms.map((p) => (
              <Badge
                key={p}
                className={`text-[10px] border-0 px-2 py-0.5 gap-1 ${platformBadgeColors[p] ?? "bg-gray-900/30 text-gray-400"}`}
              >
                <PlatformLogo platform={p} className="h-3 w-3" />
                {platformLabels[p] ?? p}
              </Badge>
            ))}
          </div>

          {/* Faux actions */}
          <div className="flex items-center gap-3 pt-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 cursor-default">
              <ScanSearch className="h-3.5 w-3.5" />
              Scan Now
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground cursor-default">
              <ArrowRight className="h-3.5 w-3.5" />
              View Results
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
