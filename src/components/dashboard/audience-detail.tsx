"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Radio,
  Pencil,
  ExternalLink,
  X,
  MessageSquare,
} from "lucide-react";
import { getPlatformDisplayName, getPlatformBadgeColor } from "@/lib/platform-utils";
import type { Audience, Monitor, Result } from "@/lib/db/schema";

interface AudienceDetailProps {
  audience: Audience;
  monitors: Monitor[];
  results: Result[];
  availableMonitors: Monitor[];
}

export function AudienceDetail({
  audience,
  monitors,
  results,
  availableMonitors,
}: AudienceDetailProps) {
  const router = useRouter();
  const [isAddingMonitor, setIsAddingMonitor] = useState(false);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>("");
  const [removeMonitorId, setRemoveMonitorId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleAddMonitor = async () => {
    if (!selectedMonitorId) return;
    setIsAddingMonitor(true);
    try {
      const response = await fetch(`/api/audiences/${audience.id}/monitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId: selectedMonitorId }),
      });
      if (response.ok) {
        setSelectedMonitorId("");
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to add monitor:", error);
    } finally {
      setIsAddingMonitor(false);
    }
  };

  const handleRemoveMonitor = async () => {
    if (!removeMonitorId) return;
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/audiences/${audience.id}/monitors`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId: removeMonitorId }),
      });
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to remove monitor:", error);
    } finally {
      setIsRemoving(false);
      setRemoveMonitorId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/audiences">
            <Button variant="ghost" size="icon" aria-label="Back to audiences">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {audience.color && (
              <div
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: audience.color }}
              />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{audience.name}</h1>
              {audience.description && (
                <p className="text-muted-foreground">{audience.description}</p>
              )}
            </div>
          </div>
        </div>
        <Link href={`/dashboard/audiences/${audience.id}/edit`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monitors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent Results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(audience.createdAt)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Monitors Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Monitors
              </CardTitle>
              <CardDescription>
                Monitors in this audience group.
              </CardDescription>
            </div>
            {availableMonitors.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedMonitorId}
                  onValueChange={setSelectedMonitorId}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select monitor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonitors.map((monitor) => (
                      <SelectItem key={monitor.id} value={monitor.id}>
                        {monitor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMonitor}
                  disabled={!selectedMonitorId || isAddingMonitor}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {monitors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No monitors in this audience yet.</p>
              <p className="text-sm">Add monitors to start tracking this segment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {monitors.map((monitor) => {
                const platformList = monitor.platforms || [];
                return (
                  <div
                    key={monitor.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          monitor.isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                        role="status"
                        aria-label={monitor.isActive ? "Active" : "Paused"}
                        title={monitor.isActive ? "Active" : "Paused"}
                      />
                      <div>
                        <div className="font-medium">{monitor.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {platformList.slice(0, 3).map((p) => (
                            <Badge key={p} variant="secondary" className={`text-xs ${getPlatformBadgeColor(p, "light")}`}>
                              {getPlatformDisplayName(p)}
                            </Badge>
                          ))}
                          {platformList.length > 3 && (
                            <span>+{platformList.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/monitors/${monitor.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`View monitor ${monitor.name}`}>
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveMonitorId(monitor.id)}
                        aria-label={`Remove monitor ${monitor.name} from audience`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Results
          </CardTitle>
          <CardDescription>
            Latest mentions from all monitors in this audience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No results yet.</p>
              <p className="text-sm">Results will appear here as monitors find mentions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.slice(0, 10).map((result) => {
                return (
                  <div
                    key={result.id}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium line-clamp-1">{result.title}</h4>
                      <Badge
                        variant="secondary"
                        className={getPlatformBadgeColor(result.platform, "light")}
                      >
                        {getPlatformDisplayName(result.platform)}
                      </Badge>
                    </div>
                    {result.content && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {result.content}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(result.createdAt)}</span>
                      {result.sourceUrl && (
                        <a
                          href={result.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {results.length > 10 && (
                <Link href="/dashboard/results">
                  <Button variant="outline" className="w-full">
                    View All Results
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove Monitor Dialog */}
      <AlertDialog open={!!removeMonitorId} onOpenChange={() => setRemoveMonitorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Monitor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this monitor from the audience? The
              monitor and its results will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMonitor} disabled={isRemoving}>
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
