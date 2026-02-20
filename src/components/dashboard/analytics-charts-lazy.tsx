"use client";

import dynamic from "next/dynamic";

const AnalyticsCharts = dynamic(
  () => import("@/components/dashboard/analytics-charts").then((mod) => ({ default: mod.AnalyticsCharts })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-24 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="animate-pulse h-80 bg-muted rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="animate-pulse h-64 bg-muted rounded-lg" />
          <div className="animate-pulse h-64 bg-muted rounded-lg" />
        </div>
      </div>
    ),
  }
);

export { AnalyticsCharts as LazyAnalyticsCharts };
