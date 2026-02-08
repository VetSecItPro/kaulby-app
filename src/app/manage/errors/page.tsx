"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  Trash2,
} from "lucide-react";

interface ErrorLog {
  id: string;
  level: string;
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  requestId?: string;
  userId?: string;
  endpoint?: string;
  statusCode?: number;
  duration?: number;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
  createdAt: string;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  byLevel: {
    error: number;
    warning: number;
    fatal: number;
  };
  bySource: Record<string, number>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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

const levelBadgeVariants = {
  error: "destructive" as const,
  warning: "outline" as const,
  fatal: "destructive" as const,
};

const sourceLabels: Record<string, string> = {
  api: "API",
  inngest: "Background Job",
  ai: "AI/ML",
  webhook: "Webhook",
  auth: "Auth",
  cron: "Cron",
  database: "Database",
};

export default function ErrorLogsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [level, setLevel] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [resolved, setResolved] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Dialog state
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "50");
      if (level) params.set("level", level);
      if (source) params.set("source", source);
      if (resolved) params.set("resolved", resolved);
      if (search) params.set("search", search);

      const response = await fetch(`/api/admin/errors?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch errors");

      const data = await response.json();
      setErrors(data.errors);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to fetch errors:", error);
    } finally {
      setLoading(false);
    }
  }, [level, source, resolved, search, page]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const handleResolve = async (errorId: string, isResolved: boolean) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/errors/${errorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: isResolved }),
      });

      if (!response.ok) throw new Error("Failed to update error");

      fetchErrors();
      if (selectedError?.id === errorId) {
        const updated = await response.json();
        setSelectedError(updated);
      }
    } catch (error) {
      console.error("Failed to resolve error:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedError) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/errors/${selectedError.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) throw new Error("Failed to save notes");

      const updated = await response.json();
      setSelectedError(updated);
      fetchErrors();
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (errorId: string) => {
    if (!confirm("Are you sure you want to delete this error log?")) return;

    try {
      const response = await fetch(`/api/admin/errors/${errorId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete error");

      setShowDetails(false);
      setSelectedError(null);
      fetchErrors();
    } catch (error) {
      console.error("Failed to delete error:", error);
    }
  };

  const openDetails = (error: ErrorLog) => {
    setSelectedError(error);
    setNotes(error.notes || "");
    setShowDetails(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

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

  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Error Logs</h1>
            <p className="text-muted-foreground">Monitor and resolve application errors</p>
          </div>
        </div>
        <Button onClick={fetchErrors} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className={stats.unresolved > 0 ? "border-red-500/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unresolved</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.unresolved > 0 ? "text-red-500" : "text-green-500"}`}>
                {stats.unresolved}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.byLevel.error}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats.byLevel.warning}</div>
            </CardContent>
          </Card>
          <Card className={stats.byLevel.fatal > 0 ? "border-red-700/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fatal</CardTitle>
              <XCircle className="h-4 w-4 text-red-700" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.byLevel.fatal > 0 ? "text-red-700" : ""}`}>
                {stats.byLevel.fatal}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search errors..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>
            <Select
              value={level}
              onValueChange={(v) => {
                setLevel(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]" aria-label="Filter by error level">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="fatal">Fatal</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]" aria-label="Filter by error source">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Sources</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="inngest">Background Job</SelectItem>
                <SelectItem value="ai">AI/ML</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="cron">Cron</SelectItem>
                <SelectItem value="database">Database</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={resolved}
              onValueChange={(v) => {
                setResolved(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]" aria-label="Filter by resolution status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="false">Unresolved</SelectItem>
                <SelectItem value="true">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Error Logs</CardTitle>
          <CardDescription>
            {pagination ? `Showing ${errors.length} of ${pagination.total} errors` : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : errors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">No errors found</p>
              <p>Your application is running smoothly</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Level</TableHead>
                  <TableHead className="w-[120px]">Source</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[120px]">Endpoint</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Time</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((error) => {
                  const LevelIcon = levelIcons[error.level as keyof typeof levelIcons] || AlertCircle;
                  return (
                    <TableRow key={error.id} className={error.resolved ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <LevelIcon className={`h-4 w-4 ${levelColors[error.level as keyof typeof levelColors]}`} />
                          <Badge variant={levelBadgeVariants[error.level as keyof typeof levelBadgeVariants] || "outline"}>
                            {error.level}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {sourceLabels[error.source] || error.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px] truncate font-mono text-sm">
                          {error.message}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate block max-w-[100px]">
                          {error.endpoint || "-"}
                        </code>
                      </TableCell>
                      <TableCell>
                        {error.resolved ? (
                          <Badge variant="outline" className="border-green-500 text-green-500">
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Open</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatRelativeTime(error.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetails(error)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!error.resolved && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleResolve(error.id, true)}
                              disabled={updating}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedError && (
                <>
                  {(() => {
                    const LevelIcon = levelIcons[selectedError.level as keyof typeof levelIcons] || AlertCircle;
                    return <LevelIcon className={`h-5 w-5 ${levelColors[selectedError.level as keyof typeof levelColors]}`} />;
                  })()}
                  Error Details
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedError && formatDate(selectedError.createdAt)}
            </DialogDescription>
          </DialogHeader>

          {selectedError && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Level:</span>{" "}
                  <Badge variant={levelBadgeVariants[selectedError.level as keyof typeof levelBadgeVariants] || "outline"}>
                    {selectedError.level}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>{" "}
                  <Badge variant="secondary">{sourceLabels[selectedError.source] || selectedError.source}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {selectedError.resolved ? (
                    <Badge variant="outline" className="border-green-500 text-green-500">Resolved</Badge>
                  ) : (
                    <Badge variant="destructive">Open</Badge>
                  )}
                </div>
                {selectedError.endpoint && (
                  <div>
                    <span className="text-muted-foreground">Endpoint:</span>{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedError.endpoint}</code>
                  </div>
                )}
                {selectedError.statusCode && (
                  <div>
                    <span className="text-muted-foreground">Status Code:</span>{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedError.statusCode}</code>
                  </div>
                )}
                {selectedError.userId && (
                  <div>
                    <span className="text-muted-foreground">User:</span>{" "}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{selectedError.userId}</code>
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <h4 className="font-medium mb-2">Message</h4>
                <div className="bg-muted p-3 rounded-md font-mono text-sm">
                  {selectedError.message}
                </div>
              </div>

              {/* Stack trace */}
              {selectedError.stack && (
                <div>
                  <h4 className="font-medium mb-2">Stack Trace</h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-[200px]">
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              {/* Context */}
              {selectedError.context && Object.keys(selectedError.context).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Context</h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedError.context, null, 2)}
                  </pre>
                </div>
              )}

              {/* Notes */}
              <div>
                <h4 className="font-medium mb-2">Admin Notes</h4>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this error or how it was resolved..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => selectedError && handleDelete(selectedError.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <div className="flex-1" />
            {selectedError && !selectedError.resolved && (
              <Button
                variant="outline"
                onClick={() => handleResolve(selectedError.id, true)}
                disabled={updating}
              >
                <Check className="h-4 w-4 mr-2" />
                Mark Resolved
              </Button>
            )}
            {selectedError && selectedError.resolved && (
              <Button
                variant="outline"
                onClick={() => handleResolve(selectedError.id, false)}
                disabled={updating}
              >
                Reopen
              </Button>
            )}
            <Button onClick={handleSaveNotes} disabled={updating}>
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
