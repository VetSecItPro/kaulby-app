"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MobileMonitors } from "@/components/mobile/mobile-monitors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PlusCircle, Radio, MoreVertical, Pause, Play, Copy, Trash2, CheckSquare, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { tracking } from "@/lib/tracking";
import { getPlatformDisplayName } from "@/lib/platform-utils";
import { EmptyState } from "./empty-states";
import { RefreshDelayBanner } from "./upgrade-prompt";
import { ScanButton } from "./scan-button";
import type { PlanKey } from "@/lib/plans";

interface Monitor {
  id: string;
  name: string;
  keywords: string[];
  platforms: string[];
  isActive: boolean;
  isScanning?: boolean;
  lastManualScanAt?: Date | null;
  lastCheckedAt?: Date | string | null;
  newMatchCount?: number;
  createdAt: Date;
}

function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface RefreshInfo {
  plan: PlanKey;
  refreshDelayHours: number;
  nextRefreshAt: Date | null;
}

interface ResponsiveMonitorsProps {
  monitors: Monitor[];
  refreshInfo?: RefreshInfo;
}

// Renders both layouts on SSR to avoid hydration mismatch,
// then after mount switches to rendering only the active one.
// This prevents duplicate API calls (scan status checks) from both components.
export function ResponsiveMonitors({ monitors, refreshInfo }: ResponsiveMonitorsProps) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    setMounted(true);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // SSR + first paint: render both with CSS visibility (no fetch duplication
  // because useEffect-based fetches haven't fired yet on first render)
  if (!mounted) {
    return (
      <>
        <div className="lg:hidden">
          <MobileMonitors monitors={monitors} refreshInfo={refreshInfo} />
        </div>
        <DesktopMonitors monitors={monitors} refreshInfo={refreshInfo} />
      </>
    );
  }

  // After mount: render only the active layout — prevents duplicate API calls
  return isDesktop
    ? <DesktopMonitors monitors={monitors} refreshInfo={refreshInfo} />
    : <MobileMonitors monitors={monitors} refreshInfo={refreshInfo} />;
}

// Monitor actions dropdown menu
interface MonitorActionsProps {
  monitor: Monitor;
  onUpdate: () => void;
}

function MonitorActionsMenu({ monitor, onUpdate }: MonitorActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleTogglePause = async () => {
    setIsToggling(true);
    try {
      const response = await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !monitor.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update monitor");

      toast.success(monitor.isActive ? "Monitor paused" : "Monitor resumed");
      onUpdate();
      router.refresh();
    } catch {
      toast.error("Failed to update monitor");
    } finally {
      setIsToggling(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const response = await fetch(`/api/monitors/${monitor.id}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to duplicate monitor");

      const data = await response.json();
      tracking.monitorDuplicated(monitor.id);
      toast.success("Monitor duplicated");
      onUpdate();
      router.refresh();
      router.push(`/dashboard/monitors/${data.id}/edit`);
    } catch {
      toast.error("Failed to duplicate monitor");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/monitors/${monitor.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete monitor");

      tracking.monitorDeleted(monitor.id);
      toast.success("Monitor deleted");
      setShowDeleteDialog(false);
      onUpdate();
      router.refresh();
    } catch {
      toast.error("Failed to delete monitor");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleTogglePause} disabled={isToggling}>
            {monitor.isActive ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause Monitor
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Resume Monitor
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Monitor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{monitor.name}&quot;? This will also delete all
              associated results. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DesktopMonitors({ monitors, refreshInfo }: ResponsiveMonitorsProps) {
  const router = useRouter();
  const [, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkPausing, setIsBulkPausing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const handleScanComplete = () => {
    // Force re-render to update results
    setRefreshKey((k) => k + 1);
  };

  const handleMonitorUpdate = () => {
    setRefreshKey((k) => k + 1);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(monitors.map((m) => m.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkPause = async () => {
    setIsBulkPausing(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/monitors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });
      }
      toast.success(`${selectedIds.size} monitor${selectedIds.size > 1 ? "s" : ""} paused`);
      clearSelection();
      router.refresh();
    } catch {
      toast.error("Failed to pause monitors");
    } finally {
      setIsBulkPausing(false);
    }
  };

  const handleBulkResume = async () => {
    setIsBulkPausing(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/monitors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
      }
      toast.success(`${selectedIds.size} monitor${selectedIds.size > 1 ? "s" : ""} resumed`);
      clearSelection();
      router.refresh();
    } catch {
      toast.error("Failed to resume monitors");
    } finally {
      setIsBulkPausing(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        tracking.monitorDeleted(id);
        await fetch(`/api/monitors/${id}`, { method: "DELETE" });
      }
      toast.success(`${selectedIds.size} monitor${selectedIds.size > 1 ? "s" : ""} deleted`);
      clearSelection();
      setShowBulkDeleteDialog(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete monitors");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const hasSelection = selectedIds.size > 0;
  const allSelected = monitors.length > 0 && selectedIds.size === monitors.length;

  return (
    <div className="hidden lg:block space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitors</h1>
          <p className="text-muted-foreground">
            Track keywords and topics across platforms.
          </p>
        </div>
        <Link href="/dashboard/monitors/new">
          <Button className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Monitor
          </Button>
        </Link>
      </div>

      {/* Bulk Actions Bar */}
      {hasSelection && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg border"
        >
          <div className="flex items-center gap-3">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button variant="ghost" size="sm" onClick={allSelected ? clearSelection : selectAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkPause}
              disabled={isBulkPausing}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkResume}
              disabled={isBulkPausing}
            >
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              disabled={isBulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button variant="ghost" size="icon" onClick={clearSelection} aria-label="Clear selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Monitor{selectedIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} monitor{selectedIds.size > 1 ? "s" : ""} and all associated results.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refresh Delay Banner */}
      {refreshInfo && refreshInfo.refreshDelayHours > 0 && (
        <RefreshDelayBanner
          delayHours={refreshInfo.refreshDelayHours}
          nextRefreshAt={refreshInfo.nextRefreshAt}
          subscriptionStatus={refreshInfo.plan}
        />
      )}

      {/* Monitors List */}
      {monitors.length === 0 ? (
        <EmptyState type="monitors" />
      ) : (
        <div className="grid gap-4">
          {monitors.map((monitor, index) => (
            <motion.div
              key={monitor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{
                y: -2,
                transition: { duration: 0.2 },
              }}
            >
            <Card className={`transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5 ${selectedIds.has(monitor.id) ? "ring-2 ring-primary" : ""}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(monitor.id)}
                      onCheckedChange={() => toggleSelection(monitor.id)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-primary" />
                        <CardTitle className="text-lg">{monitor.name}</CardTitle>
                      <Badge variant={monitor.isActive ? "default" : "secondary"}>
                        {monitor.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                      <CardDescription>
                        Keywords: {monitor.keywords.join(", ")}
                      </CardDescription>
                    </div>
                  </div>
                  <MonitorActionsMenu monitor={monitor} onUpdate={handleMonitorUpdate} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Platforms:</span>
                  <div className="flex gap-1">
                    {monitor.platforms.map((platform) => (
                      <Badge
                        key={platform}
                        variant="outline"
                      >
                        {getPlatformDisplayName(platform)}
                      </Badge>
                    ))}
                  </div>
                </div>
                {monitor.lastCheckedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last refreshed {formatRelativeTime(monitor.lastCheckedAt)}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <ScanButton
                    monitorId={monitor.id}
                    isActive={monitor.isActive}
                    initialIsScanning={monitor.isScanning}
                    onScanComplete={handleScanComplete}
                  />
                  <Link href={`/dashboard/monitors/${monitor.id}`}>
                    <Button size="sm" className="bg-teal-500 text-black hover:bg-teal-600">
                      View Results
                    </Button>
                  </Link>
                  <Link href={`/dashboard/monitors/${monitor.id}/edit`}>
                    <Button variant="outline" size="sm" className="border-teal-500 text-teal-500 hover:bg-teal-500/10">
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
