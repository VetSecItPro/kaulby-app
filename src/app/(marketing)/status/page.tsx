"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// SEO metadata must be in a separate layout or head component for client components
// We handle it via the generateMetadata in a separate file

const SERVICE_LABELS: Record<string, { label: string; description: string }> = {
  database: { label: "Database", description: "Primary data store (Neon Postgres)" },
  redis: { label: "Cache", description: "In-memory cache (Upstash Redis)" },
  resend: { label: "Email Delivery", description: "Transactional email service" },
  serper: { label: "Search API", description: "Web search for monitoring" },
  inngest: { label: "Background Jobs", description: "Scheduled task processing" },
};

interface ServiceStatus {
  status: "up" | "down" | "degraded";
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  services: Record<string, ServiceStatus>;
  timestamp: string;
  version: string;
}

function StatusDot({ status }: { status: "up" | "down" | "degraded" }) {
  const colors = {
    up: "bg-emerald-500 shadow-emerald-500/50",
    degraded: "bg-amber-500 shadow-amber-500/50",
    down: "bg-red-500 shadow-red-500/50",
  };

  return (
    <span className="relative flex h-3 w-3">
      {status === "up" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={`relative inline-flex h-3 w-3 rounded-full shadow-[0_0_8px] ${colors[status]}`}
      />
    </span>
  );
}

function StatusLabel({ status }: { status: "up" | "down" | "degraded" }) {
  const labels = {
    up: "Operational",
    degraded: "Degraded",
    down: "Outage",
  };
  const colors = {
    up: "text-emerald-400",
    degraded: "text-amber-400",
    down: "text-red-400",
  };
  return <span className={`text-sm font-medium ${colors[status]}`}>{labels[status]}</span>;
}

function OverallBanner({ status }: { status: "healthy" | "degraded" | "unhealthy" }) {
  const config = {
    healthy: {
      label: "All Systems Operational",
      bg: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
      text: "text-emerald-400",
      icon: (
        <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    degraded: {
      label: "Partial System Outage",
      bg: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
      text: "text-amber-400",
      icon: (
        <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
    },
    unhealthy: {
      label: "Major System Outage",
      bg: "from-red-500/10 to-red-500/5 border-red-500/20",
      text: "text-red-400",
      icon: (
        <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const c = config[status];

  return (
    <div className={`rounded-xl border bg-gradient-to-r ${c.bg} p-6 flex items-center gap-4`}>
      {c.icon}
      <h2 className={`text-xl font-semibold ${c.text}`}>{c.label}</h2>
    </div>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [nextRefresh, setNextRefresh] = useState(30);

  const fetchHealth = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/health", { cache: "no-store", signal });
      const data: HealthResponse = await res.json();
      setHealth(data);
      setError(null);
      setLastChecked(new Date());
      setNextRefresh(30);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Unable to reach health endpoint");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal);
    const interval = setInterval(() => fetchHealth(controller.signal), 30_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchHealth]);

  // Countdown timer
  useEffect(() => {
    const countdown = setInterval(() => {
      setNextRefresh((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

  return (
    <div className="container max-w-3xl py-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">System Status</h1>
        <p className="text-muted-foreground">
          Real-time health of all Kaulby services.
        </p>
      </div>

      {/* Loading state */}
      {!health && !error && (
        <div className="space-y-4">
          <div className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={() => fetchHealth()}
            className="mt-3 text-sm text-red-300 underline underline-offset-4 hover:text-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Health data */}
      {health && (
        <div className="space-y-6">
          {/* Overall status banner */}
          <OverallBanner status={health.status} />

          {/* Service list */}
          <div className="space-y-3">
            {Object.entries(health.services).map(([key, service]) => {
              const meta = SERVICE_LABELS[key] || { label: key, description: "" };
              return (
                <Card
                  key={key}
                  className="flex items-center justify-between p-4 bg-card/50 backdrop-blur-sm border-border/50"
                >
                  <div className="flex items-center gap-4">
                    <StatusDot status={service.status} />
                    <div>
                      <p className="font-medium text-foreground">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {service.status === "up" && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {service.latencyMs}ms
                      </Badge>
                    )}
                    <StatusLabel status={service.status} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Last checked:{" "}
                {lastChecked
                  ? lastChecked.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "---"}
              </span>
              <span className="text-muted-foreground/60">
                (refreshing in {nextRefresh}s)
              </span>
            </div>
            {health.version && (
              <span className="text-xs text-muted-foreground/50 font-mono">
                v{health.version}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Powered by footer */}
      <div className="mt-16 text-center text-xs text-muted-foreground/40">
        Powered by Kaulby
      </div>
    </div>
  );
}
