"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

interface AiCostData {
  date: string;
  totalCost: string | number | null;
  totalCalls: number;
  totalTokens: string | number | null;
}

interface AiCostsTableProps {
  costs: AiCostData[];
}

export function AiCostsTable({ costs }: AiCostsTableProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatNumber = (num: string | number | null) => {
    if (num === null || num === undefined) return "0";
    return Number(num).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          AI Usage Details
        </CardTitle>
        <CardDescription>Daily breakdown of AI API usage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-muted">
                <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">
                  Date
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground py-2 px-4">
                  Calls
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground py-2 px-4">
                  Tokens
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground py-2 pl-4">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {costs.length > 0 ? (
                costs.slice(0, 10).map((cost) => (
                  <tr
                    key={cost.date}
                    className="border-b border-muted/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 pr-4 text-sm">
                      {formatDate(cost.date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right tabular-nums">
                      {cost.totalCalls.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-right tabular-nums text-muted-foreground">
                      {formatNumber(cost.totalTokens)}
                    </td>
                    <td className="py-3 pl-4 text-sm text-right tabular-nums font-medium text-amber-500">
                      ${(Number(cost.totalCost) || 0).toFixed(4)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No AI usage data available
                  </td>
                </tr>
              )}
            </tbody>
            {costs.length > 0 && (
              <tfoot>
                <tr className="border-t border-muted">
                  <td className="py-3 pr-4 text-sm font-medium">
                    Total (30 days)
                  </td>
                  <td className="py-3 px-4 text-sm text-right tabular-nums font-medium">
                    {costs.reduce((sum, c) => sum + c.totalCalls, 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-right tabular-nums font-medium text-muted-foreground">
                    {formatNumber(
                      costs.reduce((sum, c) => sum + (Number(c.totalTokens) || 0), 0).toString()
                    )}
                  </td>
                  <td className="py-3 pl-4 text-sm text-right tabular-nums font-bold text-amber-500">
                    ${costs.reduce((sum, c) => sum + (Number(c.totalCost) || 0), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
