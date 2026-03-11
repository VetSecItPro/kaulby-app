"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ScanButtonProps {
  monitorId: string;
  isActive: boolean;
  initialIsScanning?: boolean;
  onScanComplete?: () => void;
  /** Render at default size instead of "sm" */
  size?: "sm" | "default";
}

export function ScanButton({ monitorId, isActive, initialIsScanning, onScanComplete, size = "sm" }: ScanButtonProps) {
  const [isScanning, setIsScanning] = useState(initialIsScanning || false);
  const [canScan, setCanScan] = useState<boolean | null>(null); // null = loading
  const [cooldownText, setCooldownText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    step: string;
    platformsTotal: number;
    platformsCompleted: number;
    platformResults: Record<string, number>;
    currentPlatform: string | null;
  } | null>(null);

  // Rate limit backoff
  const [pollInterval, setPollInterval] = useState(10000);
  const [stopped, setStopped] = useState(false);

  // Check scan status on mount and periodically while scanning
  const checkScanStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitors/${monitorId}/scan`);
      if (response.status === 429) {
        setPollInterval(30000);
        return;
      }
      if (response.status === 404) {
        setStopped(true);
        setIsScanning(false);
        return;
      }
      if (response.ok) {
        setPollInterval(10000);
        const data = await response.json();
        setIsScanning(data.isScanning);
        setCanScan(data.canScan);
        setScanProgress(data.scanProgress || null);

        if (data.cooldownRemaining) {
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
      setCanScan(true);
    }
  }, [monitorId, initialIsScanning, onScanComplete]);

  useEffect(() => {
    checkScanStatus();

    // Poll while scanning (10s default, 30s on rate limit backoff)
    if (isScanning && !stopped) {
      const interval = setInterval(checkScanStatus, pollInterval);
      return () => clearInterval(interval);
    }
  }, [isScanning, stopped, checkScanStatus, pollInterval]);

  const handleScan = async () => {
    if (!isActive || isScanning || !canScan) return;

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch(`/api/monitors/${monitorId}/scan`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 429) {
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

      toast.success("Scan started! Results will appear shortly.");
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
        size={size}
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
        size={size}
        disabled
        className="bg-teal-500/50 text-black cursor-wait"
      >
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Currently scanning — show progress
  if (isScanning) {
    const progressText = scanProgress?.currentPlatform
      ? `Scanning ${scanProgress.currentPlatform}... (${scanProgress.platformsCompleted}/${scanProgress.platformsTotal})`
      : "Starting scan...";
    const totalFound = scanProgress
      ? Object.values(scanProgress.platformResults).reduce((sum, n) => sum + n, 0)
      : 0;

    return (
      <div className="flex flex-col gap-1">
        <Button
          size={size}
          disabled
          className="bg-teal-500/70 text-black cursor-wait"
        >
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          {progressText}
        </Button>
        {totalFound > 0 && (
          <span className="text-xs text-teal-400 pl-1">{totalFound} result{totalFound !== 1 ? "s" : ""} found</span>
        )}
      </div>
    );
  }

  // In cooldown period
  if (!canScan) {
    return (
      <Button
        size={size}
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
      size={size}
      onClick={handleScan}
      className="bg-teal-500 text-black hover:bg-teal-600"
      title={error || undefined}
    >
      <RefreshCw className="h-4 w-4 mr-1" />
      Scan Now
    </Button>
  );
}
