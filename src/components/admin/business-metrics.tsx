"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface BusinessMetricsProps {
  mrr: number;
  mrrChange: number;
  arr: number;
  conversionRate: number;
  conversionRateChange: number;
  avgRevenuePerUser: number;
  proConversions: number;
  enterpriseConversions: number;
  monthlySignups: number;
  paidUserPercentage: number;
}

export function BusinessMetrics({
  mrr,
  mrrChange,
  arr,
  conversionRate,
  conversionRateChange,
  avgRevenuePerUser,
  proConversions,
  enterpriseConversions,
  monthlySignups,
  paidUserPercentage,
}: BusinessMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Business Metrics</h2>
        <Badge variant="outline">Last 30 days</Badge>
      </div>

      {/* Primary Revenue Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mrr)}</div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(mrrChange)}`}>
              {getTrendIcon(mrrChange)}
              {mrrChange > 0 ? "+" : ""}{formatPercent(mrrChange)} from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arr)}</div>
            <p className="text-xs text-muted-foreground">
              Projected annual revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgRevenuePerUser)}</div>
            <p className="text-xs text-muted-foreground">
              Avg revenue per user
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(paidUserPercentage)}</div>
            <p className="text-xs text-muted-foreground">
              Of total user base
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversion Funnel</CardTitle>
          <CardDescription>User journey from signup to paid plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Funnel visualization */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Monthly Signups</span>
                  <span className="text-sm text-muted-foreground">{monthlySignups}</span>
                </div>
                <div className="h-3 bg-primary rounded-full" style={{ width: "100%" }} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Pro Conversions</span>
                  <span className="text-sm text-muted-foreground">
                    {proConversions} ({monthlySignups > 0 ? ((proConversions / monthlySignups) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div
                  className="h-3 bg-blue-500 rounded-full"
                  style={{ width: `${monthlySignups > 0 ? (proConversions / monthlySignups) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Enterprise Conversions</span>
                  <span className="text-sm text-muted-foreground">
                    {enterpriseConversions} ({monthlySignups > 0 ? ((enterpriseConversions / monthlySignups) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div
                  className="h-3 bg-amber-500 rounded-full"
                  style={{ width: `${monthlySignups > 0 ? (enterpriseConversions / monthlySignups) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Conversion rate summary */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Overall Conversion Rate</p>
                <p className="text-xs text-muted-foreground">Free to any paid plan</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{formatPercent(conversionRate)}</p>
                <p className={`text-xs flex items-center justify-end gap-1 ${getTrendColor(conversionRateChange)}`}>
                  {conversionRateChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : conversionRateChange < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                  {conversionRateChange > 0 ? "+" : ""}{formatPercent(conversionRateChange)} vs last month
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
