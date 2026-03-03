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
  Eye,
  Target,
  Webhook,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { AdminCharts } from "./admin-charts-lazy";
import { RecentActivity } from "./recent-activity";
import { AiCostsTable } from "./ai-costs-table";
import { BusinessMetrics } from "./business-metrics";
import { CostBreakdown } from "./cost-breakdown";
import { SystemHealth } from "./system-health";
import { ErrorLogsCard } from "./error-logs-card";
import { getPlatformBarColor, getSentimentBarColor, getPlatformDisplayName } from "@/lib/platform-utils";

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

interface EngagementSummary {
  viewRate: number;
  clickRate: number;
  emailOpenRate: number;
}

interface ContentSummary {
  avgLeadScore: number;
  highQualityLeads: number;
}

interface IntegrationsSummary {
  webhookSuccessRate: number;
  activeApiKeys: number;
  totalDeliveries: number;
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
  teamConversions: number;
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

interface CostByModel {
  model: string;
  totalCost: number;
  totalCalls: number;
  totalTokens: number;
}

interface CostBreakdownData {
  costByPlan: CostByPlan[];
  topUsersByCost: TopUserCost[];
  costByModel?: CostByModel[];
  avgCostPerUser: number;
  avgCostPerPaidUser: number;
  costPerResult: number;
}

interface JobStatus {
  name: string;
  lastRun: Date | null;
  status: "success" | "failed" | "pending" | "running" | "unknown";
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
    polar: boolean;
  };
}

interface ErrorLogsSummary {
  total: number;
  unresolved: number;
  byLevel: {
    error: number;
    warning: number;
    fatal: number;
  };
  recentErrors: Array<{
    id: string;
    level: string;
    source: string;
    message: string;
    createdAt: string;
  }>;
}

interface ResponsiveManageProps {
  stats: Stats;
  freeUsers: number;
  proUsers: number;
  teamUsers: number;
  userGrowth: UserGrowth[];
  aiCosts: AiCost[];
  platformDist: PlatformDist[];
  sentimentDist: SentimentDist[];
  recentUsers: RecentUser[];
  businessMetrics: BusinessMetricsData;
  costBreakdown: CostBreakdownData;
  systemHealth: SystemHealthData;
  errorLogsSummary: ErrorLogsSummary;
  engagementSummary: EngagementSummary;
  contentSummary: ContentSummary;
  integrationsSummary: IntegrationsSummary;
  stuckMonitorCount: number;
}


// CSS-based responsive - renders both layouts, CSS handles visibility
// This prevents hydration mismatch from JS device detection
export function ResponsiveManage({
  stats,
  freeUsers,
  proUsers,
  teamUsers,
  userGrowth,
  aiCosts,
  platformDist,
  sentimentDist,
  recentUsers,
  businessMetrics,
  costBreakdown,
  systemHealth,
  errorLogsSummary,
  engagementSummary,
  contentSummary,
  integrationsSummary,
  stuckMonitorCount,
}: ResponsiveManageProps) {
  return (
    <>
      {/* Mobile/Tablet view - hidden on lg and above */}
      <div className="lg:hidden">
        <MobileManage
          stats={stats}
          freeUsers={freeUsers}
          proUsers={proUsers}
          teamUsers={teamUsers}
          platformDist={platformDist}
          sentimentDist={sentimentDist}
          recentUsers={recentUsers}
          businessMetrics={businessMetrics}
          engagementSummary={engagementSummary}
          contentSummary={contentSummary}
          integrationsSummary={integrationsSummary}
          stuckMonitorCount={stuckMonitorCount}
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
            description={`+${stats.usersToday} today • Click to view`}
            icon={Users}
            trend={stats.usersToday > 0 ? "up" : undefined}
            clickable
          />
        </Link>
        <Link href="/manage/monitors" className="block relative">
          <StatsCard
            title="Active Monitors"
            value={stats.activeMonitors}
            description={`${stats.totalMonitors} total • Click to view`}
            icon={Radio}
            clickable
          />
          {stuckMonitorCount > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-medium text-amber-500">{stuckMonitorCount} stuck</span>
            </div>
          )}
        </Link>
        <Link href="/manage/results" className="block">
          <StatsCard
            title="Results Found"
            value={stats.totalResults}
            description={`+${stats.resultsToday} today • Click to view`}
            icon={MessageSquare}
            trend={stats.resultsToday > 0 ? "up" : undefined}
            clickable
          />
        </Link>
        <Link href="/manage/costs" className="block">
          <StatsCard
            title="AI Costs (Total)"
            value={`$${stats.totalAiCost.toFixed(2)}`}
            description="Click for detailed breakdown"
            icon={DollarSign}
            clickable
          />
        </Link>
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
                style={{ width: `${stats.totalUsers > 0 ? (freeUsers / stats.totalUsers) * 100 : 0}%` }}
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
                style={{ width: `${stats.totalUsers > 0 ? (proUsers / stats.totalUsers) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{teamUsers}</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-amber-500"
                style={{ width: `${stats.totalUsers > 0 ? (teamUsers / stats.totalUsers) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health - moved up for visibility */}
      <SystemHealth {...systemHealth} />

      {/* Error Logs Summary */}
      <Link href="/manage/errors" className="block">
        <div className="transition-all hover:opacity-90 cursor-pointer">
          <ErrorLogsCard data={errorLogsSummary} />
        </div>
      </Link>

      {/* Business Metrics */}
      <Link href="/manage/business" className="block">
        <div className="transition-all hover:opacity-90 cursor-pointer">
          <BusinessMetrics {...businessMetrics} />
        </div>
      </Link>

      {/* Unit Economics */}
      <Link href="/manage/economics" className="block">
        <Card className="transition-all hover:opacity-90 cursor-pointer border-green-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Unit Economics
              </CardTitle>
              <Badge variant="outline" className="text-green-500 border-green-500">
                New
              </Badge>
            </div>
            <CardDescription>
              Revenue vs cost margin analysis, customer profitability
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      {/* New Detail Page Links */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Link href="/manage/engagement" className="block">
          <Card className="transition-all hover:border-emerald-500 hover:shadow-md cursor-pointer border-emerald-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5 text-emerald-500" />
                  Engagement
                </CardTitle>
              </div>
              <CardDescription>
                View {engagementSummary.viewRate}% · Click {engagementSummary.clickRate}% · Email Open {engagementSummary.emailOpenRate}%
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/manage/content" className="block">
          <Card className="transition-all hover:border-blue-500 hover:shadow-md cursor-pointer border-blue-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  Content Intelligence
                </CardTitle>
              </div>
              <CardDescription>
                Avg Lead Score: {contentSummary.avgLeadScore} · {contentSummary.highQualityLeads} high-quality leads
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/manage/integrations" className="block">
          <Card className="transition-all hover:border-purple-500 hover:shadow-md cursor-pointer border-purple-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-purple-500" />
                  Integrations
                </CardTitle>
              </div>
              <CardDescription>
                Webhooks: {integrationsSummary.webhookSuccessRate}% success · {integrationsSummary.activeApiKeys} API keys
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Cost Breakdown */}
      <Link href="/manage/costs" className="block">
        <div className="transition-all hover:opacity-90 cursor-pointer">
          <CostBreakdown {...costBreakdown} />
        </div>
      </Link>

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
                (() => {
                  const total = platformDist.reduce((sum, x) => sum + x.count, 0);
                  return platformDist.map((p) => {
                    const percentage = total > 0 ? (p.count / total) * 100 : 0;
                    return (
                      <div key={p.platform} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{getPlatformDisplayName(p.platform)}</span>
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
                  });
                })()
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
                (() => {
                  const filtered = sentimentDist.filter((s) => s.sentiment);
                  const total = filtered.reduce((sum, x) => sum + x.count, 0);
                  return filtered.map((s) => {
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
                  });
                })()
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
  clickable,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  clickable?: boolean;
}) {
  return (
    <Card className={clickable ? "transition-all hover:border-primary hover:shadow-md cursor-pointer" : ""}>
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
