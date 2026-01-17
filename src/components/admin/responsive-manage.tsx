"use client";

import { MobileManage } from "@/components/mobile/mobile-manage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Radio,
  MessageSquare,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { AdminCharts } from "./admin-charts";
import { RecentActivity } from "./recent-activity";
import { AiCostsTable } from "./ai-costs-table";
import { BusinessMetrics } from "./business-metrics";
import { CostBreakdown } from "./cost-breakdown";
import { SystemHealth } from "./system-health";
import { getPlatformBarColor, getSentimentBarColor } from "@/lib/platform-utils";

interface Stats {
  totalUsers: number;
  totalMonitors: number;
  totalResults: number;
  totalAiCost: number;
  activeMonitors: number;
  usersToday: number;
  resultsToday: number;
}

interface UserGrowth {
  date: string;
  count: number;
}

interface AiCost {
  date: string;
  totalCost: string | number | null;
  totalCalls: number;
  totalTokens: string | number | null;
}

interface PlatformDist {
  platform: string;
  count: number;
}

interface SentimentDist {
  sentiment: string | null;
  count: number;
}

interface RecentUser {
  id: string;
  email: string | null;
  name: string | null;
  subscriptionStatus: string | null;
  createdAt: Date | null;
}

interface BusinessMetricsData {
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

interface CostBreakdownData {
  costByPlan: CostByPlan[];
  topUsersByCost: TopUserCost[];
  avgCostPerUser: number;
  avgCostPerPaidUser: number;
  costPerResult: number;
}

interface JobStatus {
  name: string;
  lastRun: Date | null;
  status: "success" | "failed" | "pending" | "running";
  runsLast24h: number;
  failuresLast24h: number;
}

interface SystemHealthData {
  jobs: JobStatus[];
  errorRate24h: number;
  avgResponseTime: number;
  totalApiCalls24h: number;
  healthChecks: {
    database: boolean;
    ai: boolean;
    email: boolean;
    stripe: boolean;
  };
}

interface ResponsiveManageProps {
  stats: Stats;
  freeUsers: number;
  proUsers: number;
  enterpriseUsers: number;
  userGrowth: UserGrowth[];
  aiCosts: AiCost[];
  platformDist: PlatformDist[];
  sentimentDist: SentimentDist[];
  recentUsers: RecentUser[];
  businessMetrics: BusinessMetricsData;
  costBreakdown: CostBreakdownData;
  systemHealth: SystemHealthData;
}


// CSS-based responsive - renders both layouts, CSS handles visibility
// This prevents hydration mismatch from JS device detection
export function ResponsiveManage({
  stats,
  freeUsers,
  proUsers,
  enterpriseUsers,
  userGrowth,
  aiCosts,
  platformDist,
  sentimentDist,
  recentUsers,
  businessMetrics,
  costBreakdown,
  systemHealth,
}: ResponsiveManageProps) {
  return (
    <>
      {/* Mobile/Tablet view - hidden on lg and above */}
      <div className="lg:hidden">
        <MobileManage
          stats={stats}
          freeUsers={freeUsers}
          proUsers={proUsers}
          enterpriseUsers={enterpriseUsers}
          platformDist={platformDist}
          sentimentDist={sentimentDist}
          recentUsers={recentUsers}
          businessMetrics={businessMetrics}
        />
      </div>

      {/* Desktop view - hidden below lg */}
      <div className="hidden lg:flex flex-1 flex-col space-y-6 p-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform analytics and management</p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          Admin
        </Badge>
      </div>

      {/* Key Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/manage/users" className="block">
          <StatsCard
            title="Total Users"
            value={stats.totalUsers}
            description={`+${stats.usersToday} today • Click to manage`}
            icon={Users}
            trend="up"
          />
        </Link>
        <StatsCard
          title="Active Monitors"
          value={stats.activeMonitors}
          description={`${stats.totalMonitors} total`}
          icon={Radio}
        />
        <StatsCard
          title="Results Found"
          value={stats.totalResults}
          description={`+${stats.resultsToday} today`}
          icon={MessageSquare}
          trend="up"
        />
        <StatsCard
          title="AI Costs (Total)"
          value={`$${stats.totalAiCost.toFixed(2)}`}
          description="All time"
          icon={DollarSign}
        />
      </div>

      {/* Subscription Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Free Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{freeUsers}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-muted-foreground/50"
                style={{ width: `${(freeUsers / stats.totalUsers) * 100 || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pro Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{proUsers}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${(proUsers / stats.totalUsers) * 100 || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enterprise Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{enterpriseUsers}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-amber-500"
                style={{ width: `${(enterpriseUsers / stats.totalUsers) * 100 || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Metrics */}
      <BusinessMetrics {...businessMetrics} />

      {/* Cost Breakdown */}
      <CostBreakdown {...costBreakdown} />

      {/* System Health */}
      <SystemHealth {...systemHealth} />

      {/* Charts */}
      <AdminCharts userGrowth={userGrowth} aiCosts={aiCosts} />

      {/* Platform & Sentiment Distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Results by Platform</CardTitle>
            <CardDescription>Distribution of results across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {platformDist.length > 0 ? (
                platformDist.map((p) => {
                  const total = platformDist.reduce((sum, x) => sum + x.count, 0);
                  const percentage = total > 0 ? (p.count / total) * 100 : 0;
                  return (
                    <div key={p.platform} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">{p.platform}</span>
                        <span className="text-muted-foreground">
                          {p.count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full ${getPlatformBarColor(p.platform)}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-4">No results yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sentiment Analysis</CardTitle>
            <CardDescription>Breakdown of result sentiments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sentimentDist.filter((s) => s.sentiment).length > 0 ? (
                sentimentDist
                  .filter((s) => s.sentiment)
                  .map((s) => {
                    const total = sentimentDist.reduce((sum, x) => sum + x.count, 0);
                    const percentage = total > 0 ? (s.count / total) * 100 : 0;
                    return (
                      <div key={s.sentiment} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{s.sentiment}</span>
                          <span className="text-muted-foreground">
                            {s.count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full ${getSentimentBarColor(s.sentiment)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No sentiment data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivity users={recentUsers} />
        <AiCostsTable costs={aiCosts} />
      </div>
    </div>
    </>
  );
}

function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
