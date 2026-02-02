"use client";

import { useState } from "react";
import { MessageSquare, Sparkles, BarChart3, Radio } from "lucide-react";
import { BrowserFrame } from "./browser-frame";
import { MockMentionsFeed } from "./mock-mentions-feed";
import { MockInsightsView } from "./mock-insights-view";
import { MockAnalyticsView } from "./mock-analytics-view";
import { MockMonitorsView } from "./mock-monitors-view";

const tabs = [
  {
    id: "mentions",
    label: "Mentions",
    icon: MessageSquare,
    subtitle: "Track every conversation about your brand across 16 platforms.",
  },
  {
    id: "insights",
    label: "AI Insights",
    icon: Sparkles,
    subtitle:
      "AI discovers topics, trends, and sentiment patterns automatically.",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    subtitle:
      "Visualize mention volume, sentiment, and platform breakdown at a glance.",
  },
  {
    id: "monitors",
    label: "Monitors",
    icon: Radio,
    subtitle:
      "Set up keyword monitors and let Kaulby scan around the clock.",
  },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function FeatureTabs() {
  const [active, setActive] = useState<TabId>("mentions");

  const activeTab = tabs.find((t) => t.id === active)!;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1.5 p-1 rounded-full bg-muted/40 overflow-x-auto max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground text-center max-w-lg mx-auto">
        {activeTab.subtitle}
      </p>

      {/* Tab content */}
      <div className="max-w-4xl mx-auto">
        <BrowserFrame>
          <div className={active === "mentions" ? "animate-fade-in" : "hidden"}>
            <MockMentionsFeed />
          </div>
          <div className={active === "insights" ? "animate-fade-in" : "hidden"}>
            <MockInsightsView />
          </div>
          <div
            className={active === "analytics" ? "animate-fade-in" : "hidden"}
          >
            <MockAnalyticsView />
          </div>
          <div className={active === "monitors" ? "animate-fade-in" : "hidden"}>
            <MockMonitorsView />
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}
