"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type PeriodView = "daily" | "weekly" | "monthly";

interface PeriodRow {
  label: string;
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
}

interface CostPeriodToggleProps {
  dailyData: PeriodRow[];
  weeklyData: PeriodRow[];
  monthlyData: PeriodRow[];
}

const CURRENCY_FORMAT_0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const CURRENCY_FORMAT_2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

function formatCurrency(value: number, decimals = 2) {
  return (decimals === 0 ? CURRENCY_FORMAT_0 : CURRENCY_FORMAT_2).format(value);
}

function formatNumber(value: number) {
  return NUMBER_FORMAT.format(value);
}

export function CostPeriodToggle({ dailyData, weeklyData, monthlyData }: CostPeriodToggleProps) {
  const [view, setView] = useState<PeriodView>("daily");

  const dataMap: Record<PeriodView, PeriodRow[]> = {
    daily: dailyData,
    weekly: weeklyData,
    monthly: monthlyData,
  };

  const data = dataMap[view];
  const descriptions: Record<PeriodView, string> = {
    daily: "Cost breakdown by day (last 30 days)",
    weekly: "Cost breakdown by week (last 12 weeks)",
    monthly: "Cost breakdown by month (last 12 months)",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Cost Trend</CardTitle>
            <CardDescription>{descriptions[view]}</CardDescription>
          </div>
          <div className="flex gap-1">
            {(["daily", "weekly", "monthly"] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? "default" : "outline"}
                size="sm"
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">AI Calls</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Cost/Call</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, idx) => {
                const prevRow = data[idx + 1]; // data is newest-first
                const change =
                  prevRow && prevRow.totalCost > 0
                    ? ((row.totalCost - prevRow.totalCost) / prevRow.totalCost) * 100
                    : null;
                const costPerCall =
                  row.totalCalls > 0 ? row.totalCost / row.totalCalls : 0;

                return (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.totalCalls)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-500">
                      {formatCurrency(row.totalCost)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(costPerCall, 4)}
                    </TableCell>
                    <TableCell className="text-right">
                      {change === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            change > 5
                              ? "text-red-500"
                              : change < -5
                                ? "text-green-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {change > 5 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : change < -5 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No cost data for this period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
