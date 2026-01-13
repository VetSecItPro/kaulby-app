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

interface CostBreakdownProps {
  costByPlan: CostByPlan[];
  topUsersByCost: TopUserCost[];
  avgCostPerUser: number;
  avgCostPerPaidUser: number;
  costPerResult: number;
}

export function CostBreakdown({
  costByPlan,
  topUsersByCost,
  avgCostPerUser,
  avgCostPerPaidUser,
  costPerResult,
}: CostBreakdownProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

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

      {/* Cost by Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost by Plan</CardTitle>
          <CardDescription>AI costs breakdown by subscription tier</CardDescription>
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
          <CardDescription>Highest AI usage in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {topUsersByCost.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">AI Calls</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUsersByCost.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(user.plan)}</TableCell>
                    <TableCell className="text-right">{user.aiCalls.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyShort(user.totalCost)}
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
    </div>
  );
}
