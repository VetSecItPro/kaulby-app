"use client";

import { useState, useEffect, useCallback } from "react";
import { MobileMonitors } from "@/components/mobile/mobile-monitors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Radio, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getPlatformDisplayName } from "@/lib/platform-utils";

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

interface ResponsiveMonitorsProps {
  monitors: Monitor[];
}

// CSS-based responsive - renders both layouts, CSS handles visibility
// This prevents hydration mismatch from JS device detection
export function ResponsiveMonitors({ monitors }: ResponsiveMonitorsProps) {
  return (
    <>
      {/* Mobile/Tablet view - hidden on lg and above */}
      <div className="lg:hidden">
        <MobileMonitors monitors={monitors} />
      </div>

      {/* Desktop view - hidden below lg */}
      <DesktopMonitors monitors={monitors} />
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
  const [canScan, setCanScan] = useState(true);
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
      // Silently fail status check
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
          setError(data.error || "Failed to start scan");
          setIsScanning(false);
        }
        return;
      }

      // Scan started successfully - keep polling for completion
    } catch {
      setError("Network error");
      setIsScanning(false);
    }
  };

  if (!isActive) {
    return (
      <Button
        size="sm"
        disabled
        className="bg-black border border-gray-500 text-gray-500 cursor-not-allowed"
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        Scan Now
      </Button>
    );
  }

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

  if (!canScan && cooldownText) {
    return (
      <Button
        size="sm"
        disabled
        className="bg-black border border-teal-200 text-teal-200 cursor-not-allowed"
        title={`Next scan available in ${cooldownText}`}
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        {cooldownText}
      </Button>
    );
  }

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

function DesktopMonitors({ monitors }: ResponsiveMonitorsProps) {
  const [, setRefreshKey] = useState(0);

  const handleScanComplete = () => {
    // Force re-render to update results
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="hidden lg:block space-y-8">
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

      {/* Monitors List */}
      {monitors.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No monitors yet</CardTitle>
            <CardDescription>
              Create your first monitor to start tracking mentions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/monitors/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Monitor
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {monitors.map((monitor) => (
            <Card key={monitor.id}>
              <CardHeader>
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
          ))}
        </div>
      )}
    </div>
  );
}
