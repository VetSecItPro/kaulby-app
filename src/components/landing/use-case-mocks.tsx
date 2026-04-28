import {
  TrendingUp,
  ArrowUpRight,
  Flame,
  MessageSquare,
  Quote,
} from "lucide-react";
import { PlatformLogo } from "./platform-logos";
import { MOCK_PLATFORM_BREAKDOWN } from "./mock-data";

// Shared chrome wrapping each mock — gives it a "browser frame" feel without
// imitating the real dashboard chrome. Width is fluid; parent <Card> sets the
// outer bounds.
function MockFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-background/95 shadow-2xl">
      {/* Faux window dots */}
      <div className="flex items-center gap-1.5 border-b border-border/30 bg-muted/30 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-red-400/60" />
        <div className="h-2 w-2 rounded-full bg-yellow-400/60" />
        <div className="h-2 w-2 rounded-full bg-green-400/60" />
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 1. Pain Points Cluster — categorized complaint clusters with sentiment bars.
//    Maps to "Find Customer Pain Points Before You Build" use case.
// --------------------------------------------------------------------------
const PAIN_POINT_CLUSTERS = [
  {
    label: "Mobile App Experience",
    count: 14,
    trend: "+8 this week",
    severity: "high",
    examples: ["slow load", "no offline mode", "crashes on iOS"],
  },
  {
    label: "Enterprise Pricing",
    count: 11,
    trend: "+3 this week",
    severity: "medium",
    examples: ["too steep", "vs Monday.com", "ROI unclear"],
  },
  {
    label: "Missing Integrations",
    count: 7,
    trend: "+5 this week",
    severity: "medium",
    examples: ["Slack import", "Linear sync", "GitHub"],
  },
];

export function PainPointsClusterMock() {
  return (
    <MockFrame>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Pain Point Clusters</p>
        <span className="text-[10px] text-muted-foreground">Last 7 days</span>
      </div>
      <div className="space-y-2">
        {PAIN_POINT_CLUSTERS.map((cluster) => (
          <div
            key={cluster.label}
            className="rounded-lg border border-border/30 bg-muted/20 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-foreground">{cluster.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {cluster.count} mentions &middot; {cluster.trend}
                </p>
              </div>
              <span
                className={
                  cluster.severity === "high"
                    ? "shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400"
                    : "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400"
                }
              >
                {cluster.severity}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {cluster.examples.map((ex) => (
                <span
                  key={ex}
                  className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

// --------------------------------------------------------------------------
// 2. Competitor Tracker — competitor name + complaint feed with feature gaps.
//    Maps to "Track Competitor Complaints and Feature Gaps" use case.
// --------------------------------------------------------------------------
const COMPETITOR_MENTIONS = [
  {
    competitor: "Asana",
    snippet: "Frustrated by Asana's pricing tiers — looking for alternatives.",
    platform: "reddit",
    intent: 88,
  },
  {
    competitor: "Monday.com",
    snippet: "Monday's automations break weekly. Anyone tried Trellis?",
    platform: "hackernews",
    intent: 91,
  },
  {
    competitor: "Linear",
    snippet: "Linear is great for engineering but no support for design teams.",
    platform: "x",
    intent: 76,
  },
];

export function CompetitorTrackerMock() {
  return (
    <MockFrame>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Competitor Watch</p>
        <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-medium text-teal-400">
          3 hot leads
        </span>
      </div>
      <div className="space-y-2">
        {COMPETITOR_MENTIONS.map((m, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/30 bg-muted/20 p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                  {m.competitor}
                </span>
                <span className="text-muted-foreground">
                  <PlatformLogo platform={m.platform} className="h-3 w-3" />
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5">
                <Flame className="h-2.5 w-2.5 text-emerald-400" />
                <span className="text-[10px] font-medium text-emerald-400">
                  {m.intent}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{m.snippet}</p>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

// --------------------------------------------------------------------------
// 3. Buying Signals — high-intent posts with lead score badges.
//    Maps to "Catch Buying-Signal Posts" use case.
// --------------------------------------------------------------------------
const BUYING_SIGNALS = [
  {
    title: "Looking for an alternative to Asana — needs API + Slack integration",
    author: "u/buildingremote",
    platform: "reddit",
    score: 91,
    age: "2h",
  },
  {
    title: "Need a PM tool that works for both engineering AND design teams",
    author: "@sarahbuilds",
    platform: "x",
    score: 87,
    age: "4h",
  },
  {
    title: "Recommendations for AI-powered task management?",
    author: "devlead_sarah",
    platform: "hackernews",
    score: 82,
    age: "6h",
  },
];

export function BuyingSignalsMock() {
  return (
    <MockFrame>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Buying Signals</p>
        <span className="text-[10px] text-muted-foreground">Score &ge; 80</span>
      </div>
      <div className="space-y-2">
        {BUYING_SIGNALS.map((s, i) => (
          <div
            key={i}
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                {s.title}
              </p>
              <span className="shrink-0 rounded-md bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400">
                {s.score}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <PlatformLogo platform={s.platform} className="h-3 w-3" />
              <span>{s.author}</span>
              <span>&middot;</span>
              <span>{s.age} ago</span>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

// --------------------------------------------------------------------------
// 4. Brand Dashboard — multi-platform mention summary with counts.
//    Maps to "Monitor Your Brand Across 16 Platforms" use case.
// --------------------------------------------------------------------------
export function BrandDashboardMock() {
  const total = MOCK_PLATFORM_BREAKDOWN.reduce((acc, p) => acc + p.count, 0);
  return (
    <MockFrame>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Trellis - All Platforms</p>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <TrendingUp className="h-3 w-3 text-violet-400" />
          <span>{total} mentions</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {MOCK_PLATFORM_BREAKDOWN.map((p) => {
          const slug = p.platform.toLowerCase().replace(/\s+/g, "");
          return (
            <div
              key={p.platform}
              className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-2.5 py-2"
            >
              <span className="text-muted-foreground">
                <PlatformLogo platform={slug} className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-foreground truncate">
                  {p.platform}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 flex-1 rounded-full bg-background/60 overflow-hidden">
                    <div
                      className={`h-full ${p.color}`}
                      style={{ width: `${(p.count / 18) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-foreground">
                    {p.count}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MockFrame>
  );
}

// --------------------------------------------------------------------------
// 5. Voice of Customer — verbatim quotes with category tags.
//    Maps to "Validate Positioning Using Real Market Language" use case.
// --------------------------------------------------------------------------
// Tailwind JIT requires full class names at parse time, so we hard-code the
// pill color on each quote instead of building it dynamically from a token.
const CUSTOMER_QUOTES = [
  {
    quote: "the AI task prioritization is actually useful",
    author: "u/productivitynerd",
    category: "value-prop",
    pillClass: "bg-emerald-500/15 text-emerald-400",
  },
  {
    quote: "30% reduction in missed deadlines after switching",
    author: "Verified User in SaaS",
    category: "outcome",
    pillClass: "bg-cyan-500/15 text-cyan-400",
  },
  {
    quote: "automation features justify the premium",
    author: "G2 review",
    category: "objection-handler",
    pillClass: "bg-violet-500/15 text-violet-400",
  },
  {
    quote: "genuinely changed how our team works",
    author: "@sarahbuilds",
    category: "headline-fodder",
    pillClass: "bg-amber-500/15 text-amber-400",
  },
];

export function VoiceOfCustomerMock() {
  return (
    <MockFrame>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Voice of Customer</p>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MessageSquare className="h-3 w-3 text-emerald-400" />
          <span>4 phrases captured</span>
        </div>
      </div>
      <div className="space-y-2">
        {CUSTOMER_QUOTES.map((q, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/30 bg-muted/20 p-3"
          >
            <div className="flex items-start gap-2">
              <Quote className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/60" />
              <div className="flex-1">
                <p className="text-xs italic text-foreground/90 leading-snug">
                  &ldquo;{q.quote}&rdquo;
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">{q.author}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${q.pillClass}`}
                  >
                    {q.category}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground">
          <ArrowUpRight className="h-3 w-3" />
          <span>Use these phrases in your landing copy</span>
        </div>
      </div>
    </MockFrame>
  );
}
