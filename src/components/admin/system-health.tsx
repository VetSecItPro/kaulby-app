"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Activity, Server } from "lucide-react";

interface JobStatus {
  name: string;
  lastRun: Date | null;
  status: "success" | "failed" | "pending" | "running";
  runsLast24h: number;
  failuresLast24h: number;
}

interface SystemHealthProps {
  jobs: JobStatus[];
  errorRate24h: number;
  avgResponseTime: number;
  totalApiCalls24h: number;
  healthChecks: {
    database: boolean;
    ai: boolean;
    email: boolean;
    stripe: boolean;
  };
}

export function SystemHealth({
  jobs,
  errorRate24h,
  avgResponseTime,
  totalApiCalls24h,
  healthChecks,
}: SystemHealthProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/10 text-green-500">Success</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500">Failed</Badge>;
      case "running":
        return <Badge className="bg-blue-500/10 text-blue-500">Running</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getHealthStatus = (isHealthy: boolean) => {
    return isHealthy ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const allHealthy = Object.values(healthChecks).every((v) => v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">System Health</h2>
        <Badge
          variant="outline"
          className={allHealthy ? "border-green-500 text-green-500" : "border-red-500 text-red-500"}
        >
          {allHealthy ? "All Systems Operational" : "Issues Detected"}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Error Rate (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${errorRate24h > 5 ? "text-red-500" : errorRate24h > 1 ? "text-amber-500" : "text-green-500"}`}>
              {errorRate24h.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${avgResponseTime > 1000 ? "text-amber-500" : "text-green-500"}`}>
              {avgResponseTime.toFixed(0)}ms
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              API Calls (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalApiCalls24h.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(healthChecks).filter(Boolean).length}/{Object.keys(healthChecks).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>Real-time health of connected services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {getHealthStatus(healthChecks.database)}
              <div>
                <p className="font-medium">Database</p>
                <p className="text-xs text-muted-foreground">PostgreSQL</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {getHealthStatus(healthChecks.ai)}
              <div>
                <p className="font-medium">AI Service</p>
                <p className="text-xs text-muted-foreground">OpenRouter</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {getHealthStatus(healthChecks.email)}
              <div>
                <p className="font-medium">Email</p>
                <p className="text-xs text-muted-foreground">Loops</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {getHealthStatus(healthChecks.stripe)}
              <div>
                <p className="font-medium">Payments</p>
                <p className="text-xs text-muted-foreground">Stripe</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Background Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Background Jobs
          </CardTitle>
          <CardDescription>Inngest function status and history</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">{job.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Last run: {formatTimeAgo(job.lastRun)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{job.runsLast24h} runs</p>
                      {job.failuresLast24h > 0 && (
                        <p className="text-xs text-red-500">
                          {job.failuresLast24h} failures
                        </p>
                      )}
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No job data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
