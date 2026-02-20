"use client";

import { useState, useEffect, useCallback } from "react";
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
import { PlusCircle, Radio, Loader2, RefreshCw, MoreVertical, Pause, Play, Copy, Trash2, CheckSquare, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { tracking } from "@/lib/tracking";
import { getPlatformDisplayName } from "@/lib/platform-utils";
import { EmptyState } from "./empty-states";
import { RefreshDelayBanner } from "./upgrade-prompt";
import type { PlanKey } from "@/lib/plans";

interface Monitor {
  id: string;
  name: string;
  keywords: string[];
  platforms: string[];
  isActive: boolean;
  isScanning?: boolean;
  lastManualScanAt?: Date | null;
  newMatchCount?: number;
  createdAt: Date;
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

// CSS-based responsive - renders both layouts, CSS handles visibility
// This prevents hydration mismatch from JS device detection
export function ResponsiveMonitors({ monitors, refreshInfo }: ResponsiveMonitorsProps) {
  return (
    <>
      {/* Mobile/Tablet view - hidden on lg and above */}
      <div className="lg:hidden">
        <MobileMonitors monitors={monitors} refreshInfo={refreshInfo} />
      </div>

      {/* Desktop view - hidden below lg */}
      <DesktopMonitors monitors={monitors} refreshInfo={refreshInfo} />
    </>
  );
}

// Scan button component with loading state and cooldown handling
interface ScanButtonProps {
  monitorId: string;
  isActive: boolean;
  initialIsScanning?: boolean;
  onScanComplete?: () => void;
}

function ScanButton({ monitorId, isActive, initialIsScanning, onScanComplete }: ScanButtonProps) {
  const [isScanning, setIsScanning] = useState(initialIsScanning || false);
  const [canScan, setCanScan] = useState<boolean | null>(null); // null = loading
  const [cooldownText, setCooldownText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check scan status on mount and periodically while scanning
  const checkScanStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitors/${monitorId}/scan`);
      if (response.ok) {
        const data = await response.json();
        setIsScanning(data.isScanning);
        setCanScan(data.canScan);

        if (!data.canScan && data.cooldownRemaining) {
          const hours = Math.floor(data.cooldownRemaining / (1000 * 60 * 60));
          const minutes = Math.floor((data.cooldownRemaining % (1000 * 60 * 60)) / (1000 * 60));
          setCooldownText(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
        } else {
          setCooldownText(null);
        }

        // If scan just completed, notify parent
        if (!data.isScanning && initialIsScanning) {
          onScanComplete?.();
        }
      }
    } catch {
      // On error, allow scan attempt
      setCanScan(true);
    }
  }, [monitorId, initialIsScanning, onScanComplete]);

  useEffect(() => {
    checkScanStatus();

    // Poll while scanning
    if (isScanning) {
      const interval = setInterval(checkScanStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isScanning, checkScanStatus]);

  const handleScan = async () => {
    if (!isActive || isScanning || !canScan) return;

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch(`/api/monitors/${monitorId}/scan`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited
          setCanScan(false);
          const hours = Math.floor(data.cooldownRemaining / (1000 * 60 * 60));
          const minutes = Math.floor((data.cooldownRemaining % (1000 * 60 * 60)) / (1000 * 60));
          setCooldownText(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
          setIsScanning(false);
        } else {
          const errorMsg = data.error || "Failed to start scan";
          setError(errorMsg);
          toast.error("Failed to trigger scan. Please try again.");
          setIsScanning(false);
        }
        return;
      }

      // Scan started successfully - keep polling for completion
    } catch {
      setError("Network error");
      toast.error("Failed to trigger scan. Please try again.");
      setIsScanning(false);
    }
  };

  // Monitor is paused
  if (!isActive) {
    return (
      <Button
        size="sm"
        disabled
        className="bg-teal-500/20 text-teal-400/50 cursor-not-allowed border border-teal-500/30"
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        Paused
      </Button>
    );
  }

  // Loading initial state
  if (canScan === null) {
    return (
      <Button
        size="sm"
        disabled
        className="bg-teal-500/50 text-black cursor-wait"
      >
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Currently scanning
  if (isScanning) {
    return (
      <Button
        size="sm"
        disabled
        className="bg-teal-500/70 text-black cursor-wait"
      >
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Scanning...
      </Button>
    );
  }

  // In cooldown period
  if (!canScan) {
    return (
      <Button
        size="sm"
        disabled
        className="bg-teal-500/40 text-teal-100 cursor-not-allowed"
        title={cooldownText ? `Next scan available in ${cooldownText}` : "Cooldown active"}
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        {cooldownText || "Cooldown"}
      </Button>
    );
  }

  // Ready to scan
  return (
    <Button
      size="sm"
      onClick={handleScan}
      className="bg-teal-500 text-black hover:bg-teal-600"
      title={error || undefined}
    >
      <RefreshCw className="h-4 w-4 mr-1" />
      Scan Now
    </Button>
  );
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
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/monitors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        })
      );
      await Promise.all(promises);
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
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/monitors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        })
      );
      await Promise.all(promises);
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
      const promises = Array.from(selectedIds).map((id) => {
        tracking.monitorDeleted(id);
        return fetch(`/api/monitors/${id}`, { method: "DELETE" });
      });
      await Promise.all(promises);
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
        <Link href="/dashboard/monitors/new" data-tour="create-monitor">
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
