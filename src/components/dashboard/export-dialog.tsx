"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Loader2, FileSpreadsheet, FileJson, Lock } from "lucide-react";

type ExportFormat = "csv" | "json" | "full";

interface ExportDialogProps {
  /** Whether user has CSV export access (Pro+) */
  hasExportAccess: boolean;
  /** Optional monitor ID to scope export */
  monitorId?: string;
  /** Optional label for the trigger button */
  triggerLabel?: string;
  /** Compact mode for toolbar placement */
  compact?: boolean;
}

export function ExportDialog({
  hasExportAccess,
  monitorId,
  triggerLabel = "Export",
  compact = false,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);

    try {
      let url: string;

      if (format === "csv") {
        // Use streaming CSV export
        url = "/api/results/export";
        if (monitorId) url += `?monitorId=${monitorId}`;
      } else if (format === "json") {
        // Use results-only JSON export
        url = "/api/export?format=results";
      } else {
        // Full data export (monitors + audiences + results + webhooks)
        url = "/api/export?format=json";
      }

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Export failed (${response.status})`);
      }

      // Get the content disposition filename or generate one
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `kaulby-export-${new Date().toISOString().split("T")[0]}.${format === "csv" ? "csv" : "json"}`;

      // Stream the response to a blob and trigger download
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      // Could add toast notification here
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={compact ? "h-8 px-3 text-xs" : ""}
          disabled={!hasExportAccess}
        >
          {hasExportAccess ? (
            <Download className={compact ? "h-3.5 w-3.5 mr-1.5" : "h-4 w-4 mr-2"} />
          ) : (
            <Lock className={compact ? "h-3.5 w-3.5 mr-1.5" : "h-4 w-4 mr-2"} />
          )}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Results</DialogTitle>
          <DialogDescription>
            Download your monitoring data. CSV exports include results only. Full export includes monitors, audiences, and settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    <div>
                      <div className="font-medium">CSV</div>
                      <div className="text-xs text-muted-foreground">Results data, up to 10,000 rows</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    <div>
                      <div className="font-medium">JSON (Results)</div>
                      <div className="text-xs text-muted-foreground">Results with AI analysis data</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="full">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    <div>
                      <div className="font-medium">JSON (Full Export)</div>
                      <div className="text-xs text-muted-foreground">All data: monitors, audiences, results, settings</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {monitorId && format === "csv" && (
            <p className="text-xs text-muted-foreground">
              Export will be scoped to the current monitor.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
