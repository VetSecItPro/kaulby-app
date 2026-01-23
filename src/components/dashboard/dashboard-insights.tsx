"use client";

import { useState, useEffect } from "react";
import { DashboardCards, type ActionableInsight } from "./dashboard-cards";
import { Loader2 } from "lucide-react";

export function DashboardInsights() {
  const [data, setData] = useState<ActionableInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const response = await fetch("/api/dashboard/insights");
        if (response.ok) {
          const insights = await response.json();
          setData(insights);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard insights:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Top opportunity skeleton */}
        <div className="h-20 rounded-lg border bg-muted/30 animate-pulse" />
        {/* Cards grid skeleton */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-lg border bg-muted/30 animate-pulse flex items-center justify-center"
            >
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return <DashboardCards data={data} />;
}
