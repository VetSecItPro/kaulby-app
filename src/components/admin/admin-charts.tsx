"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface UserGrowthData {
  date: string;
  count: number;
}

interface AiCostData {
  date: string;
  totalCost: string | number | null;
  totalCalls: number;
  totalTokens: string | number | null;
}

interface AdminChartsProps {
  userGrowth: UserGrowthData[];
  aiCosts: AiCostData[];
}

export function AdminCharts({ userGrowth, aiCosts }: AdminChartsProps) {
  // Calculate totals for the period
  const totalNewUsers = userGrowth.reduce((sum, d) => sum + d.count, 0);
  const totalCost = aiCosts.reduce((sum, d) => sum + (Number(d.totalCost) || 0), 0);
  const totalCalls = aiCosts.reduce((sum, d) => sum + d.totalCalls, 0);

  // Format data for charts
  const userGrowthData = userGrowth.map(d => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    users: d.count,
  }));

  const aiCostData = [...aiCosts].reverse().map(d => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    cost: Number(d.totalCost) || 0,
    calls: d.totalCalls,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* User Growth Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                User Growth
              </CardTitle>
              <CardDescription>New users over the last 30 days</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{totalNewUsers}</div>
              <div className="text-xs text-muted-foreground">new users</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            {userGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(0 0% 4%)",
                      border: "1px solid hsl(0 0% 14%)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(0 0% 98%)" }}
                    itemStyle={{ color: "hsl(172, 66%, 50%)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="hsl(172, 66%, 50%)"
                    strokeWidth={2}
                    fill="url(#userGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Costs Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-500" />
                AI Costs
              </CardTitle>
              <CardDescription>Daily AI API costs over 30 days</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-500">${totalCost.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">{totalCalls.toLocaleString()} calls</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            {aiCostData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aiCostData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(0 0% 4%)",
                      border: "1px solid hsl(0 0% 14%)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "hsl(0 0% 98%)" }}
                    formatter={(value: number, name: string) => {
                      if (name === "cost") return [`$${value.toFixed(4)}`, "Cost"];
                      return [value, "Calls"];
                    }}
                  />
                  <Bar
                    dataKey="cost"
                    fill="hsl(45, 93%, 47%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
