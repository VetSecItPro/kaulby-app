"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";

interface ErrorLogsSummary {
  total: number;
  unresolved: number;
  byLevel: {
    error: number;
    warning: number;
    fatal: number;
  };
  recentErrors: Array<{
    id: string;
    level: string;
    source: string;
    message: string;
    createdAt: string;
  }>;
}

interface ErrorLogsCardProps {
  data: ErrorLogsSummary;
}

export function ErrorLogsCard({ data }: ErrorLogsCardProps) {
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const levelIcons = {
    error: AlertCircle,
    warning: AlertTriangle,
    fatal: XCircle,
  };

  const levelColors = {
    error: "text-red-500",
    warning: "text-amber-500",
    fatal: "text-red-700",
  };

  const hasIssues = data.unresolved > 0 || data.byLevel.fatal > 0;

  return (
    <Card className={data.byLevel.fatal > 0 ? "border-red-700/50" : data.unresolved > 0 ? "border-amber-500/50" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Logs
            </CardTitle>
            <CardDescription>Application errors and warnings</CardDescription>
          </div>
          {hasIssues ? (
            <Badge variant="destructive">
              {data.unresolved} Unresolved
            </Badge>
          ) : (
            <Badge variant="outline" className="border-green-500 text-green-500">
              All Clear
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{data.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${data.byLevel.error > 0 ? "text-red-500" : ""}`}>
              {data.byLevel.error}
            </div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${data.byLevel.warning > 0 ? "text-amber-500" : ""}`}>
              {data.byLevel.warning}
            </div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${data.byLevel.fatal > 0 ? "text-red-700" : ""}`}>
              {data.byLevel.fatal}
            </div>
            <div className="text-xs text-muted-foreground">Fatal</div>
          </div>
        </div>

        {/* Recent Errors */}
        {data.recentErrors.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Recent Unresolved</div>
            {data.recentErrors.slice(0, 3).map((error) => {
              const LevelIcon = levelIcons[error.level as keyof typeof levelIcons] || AlertCircle;
              return (
                <div
                  key={error.id}
                  className="flex items-start gap-2 text-sm p-2 bg-muted rounded-md"
                >
                  <LevelIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${levelColors[error.level as keyof typeof levelColors]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-mono text-xs">{error.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {error.source} • {formatRelativeTime(error.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
            <span>No unresolved errors</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
