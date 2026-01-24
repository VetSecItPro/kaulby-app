"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Play, Pause, MoreHorizontal, Loader2, RefreshCw, Copy, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { getPlatformDisplayName } from "@/lib/platform-utils";
import { RefreshDelayBanner } from "@/components/dashboard/upgrade-prompt";
import type { PlanKey } from "@/lib/plans";

interface Monitor {
  id: string;
  name: string;
  keywords: string[];
  platforms: string[];
  isActive: boolean;
  isScanning?: boolean;
  lastManualScanAt?: Date | null;
  createdAt: Date;
}

interface RefreshInfo {
  plan: PlanKey;
  refreshDelayHours: number;
  nextRefreshAt: Date | null;
}

interface MobileMonitorsProps {
  monitors: Monitor[];
  refreshInfo?: RefreshInfo;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

export function MobileMonitors({ monitors, refreshInfo }: MobileMonitorsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-2xl font-bold">Monitors</h1>
        <p className="text-muted-foreground text-sm">
          {monitors.length} active monitor{monitors.length !== 1 ? "s" : ""}
        </p>
      </motion.div>

      {/* Refresh Delay Banner */}
      {refreshInfo && refreshInfo.refreshDelayHours > 0 && (
        <motion.div variants={itemVariants}>
          <RefreshDelayBanner
            delayHours={refreshInfo.refreshDelayHours}
            nextRefreshAt={refreshInfo.nextRefreshAt}
            subscriptionStatus={refreshInfo.plan}
          />
        </motion.div>
      )}

      {/* Monitors List */}
      {monitors.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Radio className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No monitors yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first monitor to start tracking
              </p>
              <Link href="/dashboard/monitors/new">
                <Button className="w-full bg-teal-500 hover:bg-teal-600 text-black">Create Monitor</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {monitors.map((monitor) => (
              <motion.div
                key={monitor.id}
                variants={itemVariants}
                layout
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <MonitorCard monitor={monitor} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

function MonitorCard({ monitor }: { monitor: Monitor }) {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(monitor.isScanning || false);
  const [canScan, setCanScan] = useState<boolean | null>(null); // null = loading
  const [cooldownText, setCooldownText] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [currentIsActive, setCurrentIsActive] = useState(monitor.isActive);

  const handleTogglePause = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsToggling(true);
    try {
      const response = await fetch(`/api/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentIsActive }),
      });
      if (!response.ok) throw new Error("Failed to update monitor");
      setCurrentIsActive(!currentIsActive);
      toast.success(currentIsActive ? "Monitor paused" : "Monitor resumed");
      router.refresh();
    } catch {
      toast.error("Failed to update monitor");
    } finally {
      setIsToggling(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDuplicating(true);
    try {
      const response = await fetch(`/api/monitors/${monitor.id}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to duplicate monitor");
      const data = await response.json();
      toast.success("Monitor duplicated");
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
      toast.success("Monitor deleted");
      setShowDeleteDialog(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete monitor");
    } finally {
      setIsDeleting(false);
    }
  };

  // Check scan status
  const checkScanStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitors/${monitor.id}/scan`);
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
      }
    } catch {
      // On error, allow scan attempt
      setCanScan(true);
    }
  }, [monitor.id]);

  useEffect(() => {
    checkScanStatus();

    if (isScanning) {
      const interval = setInterval(checkScanStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isScanning, checkScanStatus]);

  const handleScan = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!monitor.isActive || isScanning || !canScan || canScan === null) return;

    setIsScanning(true);

    try {
      const response = await fetch(`/api/monitors/${monitor.id}/scan`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setCanScan(false);
          const hours = Math.floor(data.cooldownRemaining / (1000 * 60 * 60));
          const minutes = Math.floor((data.cooldownRemaining % (1000 * 60 * 60)) / (1000 * 60));
          setCooldownText(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
          setIsScanning(false);
        } else {
          setIsScanning(false);
        }
      }
    } catch {
      setIsScanning(false);
    }
  };

  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link href={`/dashboard/monitors/${monitor.id}`}>
        <Card className="hover:bg-accent/50 transition-colors overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Status Indicator */}
              <div
                className={`mt-1 p-2 rounded-full ${
                  isScanning
                    ? "bg-teal-500/20 text-teal-500"
                    : monitor.isActive
                    ? "bg-teal-500/10 text-teal-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : monitor.isActive ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium truncate">{monitor.name}</h3>
                  <Badge
                    variant={monitor.isActive ? "default" : "secondary"}
                    className="shrink-0 text-xs"
                  >
                    {isScanning ? "Scanning..." : monitor.isActive ? "Active" : "Paused"}
                  </Badge>
                </div>

                {/* Keywords */}
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {monitor.keywords.slice(0, 3).join(", ")}
                  {monitor.keywords.length > 3 && ` +${monitor.keywords.length - 3} more`}
                </p>

                {/* Platforms */}
                <div className="flex flex-wrap gap-1">
                  {monitor.platforms.map((platform) => (
                    <Badge
                      key={platform}
                      variant="outline"
                      className="text-xs"
                    >
                      {getPlatformDisplayName(platform)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleScan}
                    disabled={!currentIsActive || isScanning || !canScan || canScan === null}
                    className="gap-2"
                  >
                    {isScanning || canScan === null ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {canScan === null
                      ? "Loading..."
                      : isScanning
                        ? "Scanning..."
                        : !canScan
                          ? cooldownText ? `Wait ${cooldownText}` : "Cooldown"
                          : "Scan Now"}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/monitors/${monitor.id}`}>
                      View Results
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/monitors/${monitor.id}/edit`}>
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleTogglePause} disabled={isToggling}>
                    {currentIsActive ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </Link>

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
    </motion.div>
  );
}
