"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface CsvExportProps {
  dailyTrend: Array<{
    date: string;
    totalCost: number;
    totalCalls: number;
  }>;
}

export function CsvExport({ dailyTrend }: CsvExportProps) {
  const [downloading, setDownloading] = useState(false);

  function handleExport() {
    setDownloading(true);
    try {
      const headers = ["Date", "Cost (USD)", "API Calls"];
      const rows = dailyTrend.map((row) => [
        row.date,
        row.totalCost.toFixed(4),
        row.totalCalls.toString(),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `kaulby-ai-costs-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleExport}
      disabled={downloading || dailyTrend.length === 0}
    >
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  );
}
