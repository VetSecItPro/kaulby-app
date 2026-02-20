"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CostByPlan {
  plan: string;
  userCount: number;
  totalCost: number;
  avgCostPerUser: number;
}

interface TopUserCost {
  userId: string;
  email: string | null;
  name: string | null;
  plan: string;
  totalCost: number;
  aiCalls: number;
}

interface CostByModel {
  model: string;
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
}

interface CostBreakdownProps {
  costByPlan: CostByPlan[];
  topUsersByCost: TopUserCost[];
  costByModel?: CostByModel[];
  avgCostPerUser: number;
  avgCostPerPaidUser: number;
  costPerResult: number;
}

// PERF-BUILDTIME-003: Move Intl.NumberFormat to module level
const currencyFormatter4 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const currencyFormatter2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function CostBreakdown({
  costByPlan,
  topUsersByCost,
  costByModel = [],
  avgCostPerUser,
  avgCostPerPaidUser,
  costPerResult,
}: CostBreakdownProps) {
  const formatCurrency = (value: number) => currencyFormatter4.format(value);
  const formatCurrencyShort = (value: number) => currencyFormatter2.format(value);

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return <Badge className="bg-amber-500 text-white">Enterprise</Badge>;
      case "pro":
        return <Badge className="bg-primary text-primary-foreground">Pro</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cost Breakdown</h2>
        <Badge variant="outline">AI Usage</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Cost / User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyShort(avgCostPerUser)}</div>
            <p className="text-xs text-muted-foreground">All users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Cost / Paid User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyShort(avgCostPerPaidUser)}</div>
            <p className="text-xs text-muted-foreground">Pro + Enterprise</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cost / Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(costPerResult)}</div>
            <p className="text-xs text-muted-foreground">Per analyzed result</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost by Model</CardTitle>
          <CardDescription>AI costs breakdown by model (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {costByModel.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costByModel.map((item) => (
                  <TableRow key={item.model}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.model}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">{item.totalCalls.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.totalTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium text-amber-500">
                      {formatCurrencyShort(item.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No AI usage data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost by Plan and Top Users - side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cost by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cost by Plan</CardTitle>
            <CardDescription>AI costs by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costByPlan.map((item) => {
                const maxCost = Math.max(...costByPlan.map((c) => c.totalCost));
                const percentage = maxCost > 0 ? (item.totalCost / maxCost) * 100 : 0;
                return (
                  <div key={item.plan} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getPlanBadge(item.plan)}
                        <span className="text-sm text-muted-foreground">
                          {item.userCount} users
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrencyShort(item.totalCost)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrencyShort(item.avgCostPerUser)} / user
                        </div>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${
                          item.plan === "enterprise"
                            ? "bg-amber-500"
                            : item.plan === "pro"
                            ? "bg-primary"
                            : "bg-muted-foreground/50"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Users by Cost */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Users by AI Cost</CardTitle>
            <CardDescription>Highest usage (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {topUsersByCost.length > 0 ? (
              <div className="space-y-3">
                {topUsersByCost.slice(0, 5).map((user) => (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getPlanBadge(user.plan)}
                      <span className="font-medium text-amber-500">
                        {formatCurrencyShort(user.totalCost)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No AI usage data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
