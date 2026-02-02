import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  Minus,
  Flame,
  Star,
  Lightbulb,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  Eye,
} from "lucide-react";
import type { MockResult } from "./mock-data";
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
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
  g2: "G2",
  trustpilot: "Trustpilot",
  youtube: "YouTube",
  quora: "Quora",
  github: "GitHub",
};

const categoryConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  solution_request: {
    label: "Solution",
    color: "bg-blue-900/30 text-blue-400",
    icon: Lightbulb,
  },
  money_talk: {
    label: "Budget",
    color: "bg-green-900/30 text-green-400",
    icon: DollarSign,
  },
  pain_point: {
    label: "Pain Point",
    color: "bg-red-900/30 text-red-400",
    icon: AlertTriangle,
  },
  advice_request: {
    label: "Advice",
    color: "bg-purple-900/30 text-purple-400",
    icon: HelpCircle,
  },
  hot_discussion: {
    label: "Trending",
    color: "bg-amber-900/30 text-amber-400",
    icon: TrendingUp,
  },
};

function SentimentIcon({ sentiment }: { sentiment: MockResult["sentiment"] }) {
  if (sentiment === "positive")
    return <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (sentiment === "negative")
    return <ThumbsDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

export function MockResultCard({ result }: { result: MockResult }) {
  const cat = categoryConfig[result.category];
  const CatIcon = cat?.icon ?? Lightbulb;

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm p-4 space-y-2.5">
      {/* Top row: badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={`text-[10px] border-0 px-2 py-0.5 gap-1 ${platformBadgeColors[result.platform] ?? "bg-gray-900/30 text-gray-400"}`}
        >
          <PlatformLogo platform={result.platform} className="h-3 w-3" />
          {platformLabels[result.platform] ?? result.platform}
        </Badge>
        <SentimentIcon sentiment={result.sentiment} />
        {cat && (
          <Badge
            className={`text-[10px] border-0 px-2 py-0.5 gap-1 ${cat.color}`}
          >
            <CatIcon className="h-3 w-3" />
            {cat.label}
          </Badge>
        )}
        {result.leadScore >= 70 ? (
          <Badge className="text-[10px] border-0 px-2 py-0.5 bg-amber-900/30 text-amber-400 gap-1">
            <Flame className="h-3 w-3" />
            {result.leadScore}
          </Badge>
        ) : (
          <Badge className="text-[10px] border-0 px-2 py-0.5 bg-gray-900/30 text-gray-400 gap-1">
            <Star className="h-3 w-3" />
            {result.leadScore}
          </Badge>
        )}
        {result.isNew && (
          <Badge className="text-[10px] border-0 px-1.5 py-0.5 bg-teal-900/30 text-teal-400">
            New
          </Badge>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium leading-snug line-clamp-2">
        {result.title}
      </h4>

      {/* Subtitle */}
      <p className="text-xs text-muted-foreground">
        {result.monitorName} &middot; {result.author} &middot; {result.time}
      </p>

      {/* AI Summary */}
      <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
        {result.aiSummary}
      </p>

      {/* View button */}
      <div className="flex justify-end pt-1">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 cursor-default">
          <Eye className="h-3.5 w-3.5" />
          View
        </span>
      </div>
    </Card>
  );
}
