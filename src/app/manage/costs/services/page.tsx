import { db } from "@/lib/db";
import { aiLogs, results } from "@/lib/db/schema";
import { count, sum, gte, sql } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  ExternalLink,
  Cpu,
  Database,
  Zap,
  Cloud,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Apify usage API
async function getApifyUsage() {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) return null;

  try {
    // Get account info with usage stats
    const response = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) return null;
    const data = await response.json();

    // Get usage limits
    const limitsResponse = await fetch("https://api.apify.com/v2/users/me/limits", {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    });

    const limits = limitsResponse.ok ? await limitsResponse.json() : null;

    return {
      username: data.data?.username || "Unknown",
      plan: data.data?.plan?.name || "Free",
      monthlyUsageUsd: data.data?.monthlyUsageUsd || 0,
      creditBalance: data.data?.creditBalance || 0,
      limits: limits?.data || null,
    };
  } catch (error) {
    console.error("Failed to fetch Apify usage:", error);
    return null;
  }
}

// Get internal service metrics
async function getServiceMetrics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // OpenRouter costs (from aiLogs)
  const [aiStats, aiStats7d, resultStats, resultsByPlatform] = await Promise.all([
    db
      .select({
        totalCost: sum(aiLogs.costUsd),
        totalCalls: count(),
        totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, thirtyDaysAgo)),

    db
      .select({
        totalCost: sum(aiLogs.costUsd),
        totalCalls: count(),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, sevenDaysAgo)),

    db
      .select({
        total: count(),
        last7d: count(sql`CASE WHEN ${results.createdAt} >= ${sevenDaysAgo} THEN 1 END`),
      })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo)),

    db
      .select({
        platform: results.platform,
        count: count(),
      })
      .from(results)
      .where(gte(results.createdAt, thirtyDaysAgo))
      .groupBy(results.platform),
  ]);

  return {
    openRouter: {
      totalCost30d: Number(aiStats[0]?.totalCost) || 0,
      totalCost7d: Number(aiStats7d[0]?.totalCost) || 0,
      totalCalls30d: Number(aiStats[0]?.totalCalls) || 0,
      totalCalls7d: Number(aiStats7d[0]?.totalCalls) || 0,
      totalTokens: Number(aiStats[0]?.totalTokens) || 0,
    },
    scraping: {
      totalResults30d: resultStats[0]?.total || 0,
      totalResults7d: resultStats[0]?.last7d || 0,
      byPlatform: resultsByPlatform,
    },
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function ServiceCostsPage() {
  const [apifyUsage, metrics] = await Promise.all([
    getApifyUsage(),
    getServiceMetrics(),
  ]);

  // Calculate trends
  const aiTrend7d = metrics.openRouter.totalCost7d;
  const aiTrendProjected = aiTrend7d * (30 / 7);

  // Estimate Apify costs based on results scraped
  // Typical Apify scraping: ~$0.50 per 1000 results
  const estimatedApifyCost = (metrics.scraping.totalResults30d / 1000) * 0.50;

  // Total estimated monthly costs
  const totalEstimatedCost = metrics.openRouter.totalCost30d + (apifyUsage?.monthlyUsageUsd || estimatedApifyCost);

  return (
    <div className="flex-1 flex-col space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage/costs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Service Costs Dashboard</h1>
            <p className="text-muted-foreground">
              All infrastructure costs in one place (last 30 days)
            </p>
          </div>
        </div>
        <Badge variant="outline">Infrastructure</Badge>
      </div>

      {/* Total Cost Overview */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-500" />
            Total Estimated Monthly Cost
          </CardTitle>
          <CardDescription>Combined costs from all services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-4">
            <span className="text-4xl font-bold text-amber-500">
              {formatCurrency(totalEstimatedCost)}
            </span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">OpenRouter (AI)</span>
              <p className="font-medium">{formatCurrency(metrics.openRouter.totalCost30d)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Apify (Scraping)</span>
              <p className="font-medium">
                {apifyUsage ? formatCurrency(apifyUsage.monthlyUsageUsd) : `~${formatCurrency(estimatedApifyCost)}`}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Inngest (Jobs)</span>
              <p className="font-medium text-green-500">Free tier</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vercel (Hosting)</span>
              <p className="font-medium text-green-500">Free/Pro tier</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* OpenRouter Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-purple-500" />
                <CardTitle>OpenRouter</CardTitle>
              </div>
              <a href="https://openrouter.ai/usage" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1">
                  Dashboard <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
            <CardDescription>AI analysis (sentiment, pain points, summaries)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{formatCurrency(metrics.openRouter.totalCost30d)}</span>
              <div className="flex items-center gap-1 text-sm">
                {aiTrendProjected > metrics.openRouter.totalCost30d ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">Trending up</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">Stable</span>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Calls (30d)</span>
                <span>{formatNumber(metrics.openRouter.totalCalls30d)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tokens</span>
                <span>{formatNumber(metrics.openRouter.totalTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost per call</span>
                <span>
                  {metrics.openRouter.totalCalls30d > 0
                    ? formatCurrency(metrics.openRouter.totalCost30d / metrics.openRouter.totalCalls30d)
                    : "$0.00"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last 7 days</span>
                <span>{formatCurrency(metrics.openRouter.totalCost7d)}</span>
              </div>
            </div>
            <Link href="/manage/costs">
              <Button variant="outline" size="sm" className="w-full">
                View Detailed AI Costs
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Apify Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                <CardTitle>Apify</CardTitle>
              </div>
              <a href="https://console.apify.com/billing" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1">
                  Dashboard <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
            <CardDescription>Web scraping (Google Reviews, Trustpilot, etc.)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apifyUsage ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{formatCurrency(apifyUsage.monthlyUsageUsd)}</span>
                  <Badge variant="outline">{apifyUsage.plan}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credit Balance</span>
                    <span>{formatCurrency(apifyUsage.creditBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Results Scraped (30d)</span>
                    <span>{formatNumber(metrics.scraping.totalResults30d)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Results (7d)</span>
                    <span>{formatNumber(metrics.scraping.totalResults7d)}</span>
                  </div>
                </div>
                {apifyUsage.creditBalance < 5 && (
                  <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 text-amber-500 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Low credit balance - consider topping up
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">~{formatCurrency(estimatedApifyCost)}</span>
                  <Badge variant="secondary">Estimated</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Based on {formatNumber(metrics.scraping.totalResults30d)} results scraped.
                  Connect Apify API for exact costs.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Inngest Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <CardTitle>Inngest</CardTitle>
              </div>
              <a href="https://app.inngest.com" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1">
                  Dashboard <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
            <CardDescription>Background jobs (cron monitors, alerts)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-500">Free</span>
              <Badge variant="outline">Free Tier</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Concurrent Executions</span>
                <span>5 max</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Runs</span>
                <span>25,000 included</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Usage estimate</span>
                <span>Low</span>
              </div>
              <Progress value={15} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              Upgrade to Pro ($50/mo) needed if hitting concurrency limits.
            </p>
          </CardContent>
        </Card>

        {/* Vercel Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-black dark:text-white" />
                <CardTitle>Vercel</CardTitle>
              </div>
              <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1">
                  Dashboard <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
            <CardDescription>Hosting, serverless functions, edge</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-500">Pro</span>
              <Badge variant="outline">$20/mo</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serverless Function Executions</span>
                <span>1M included</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Edge Function Invocations</span>
                <span>1M included</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bandwidth</span>
                <span>1TB included</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Check Vercel dashboard for actual usage and overage charges.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping by Platform (30 days)</CardTitle>
          <CardDescription>Results collected from each platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {metrics.scraping.byPlatform.map((p) => (
              <div key={p.platform} className="flex items-center justify-between p-3 rounded-lg border">
                <span className="capitalize">{p.platform}</span>
                <Badge variant="secondary">{formatNumber(p.count)}</Badge>
              </div>
            ))}
          </div>
          {metrics.scraping.byPlatform.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No scraping data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Cost Optimization Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Optimization Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Batch AI analysis for 50+ results reduces per-result cost by ~60%</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Using Gemini 2.5 Flash instead of GPT-4 saves ~90% on AI costs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Reddit uses free official API - Apify only for rate-limited platforms</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500">!</span>
              <span>Consider caching AI analysis results for duplicate content</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
