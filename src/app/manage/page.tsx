import { db } from "@/lib/db";
import { users, monitors, results, aiLogs, errorLogs } from "@/lib/db/schema";
import { count, sum, desc, sql, gte, and, lt, eq } from "drizzle-orm";
import { ResponsiveManage } from "@/components/admin/responsive-manage";
import { PLANS } from "@/lib/plans";

// Force dynamic rendering - this page requires database access
export const dynamic = "force-dynamic";

async function getAdminStats() {
  const [
    totalUsers,
    totalMonitors,
    totalResults,
    totalAiCost,
    activeMonitors,
    usersToday,
    resultsToday,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(monitors),
    db.select({ count: count() }).from(results),
    db.select({ total: sum(aiLogs.costUsd) }).from(aiLogs),
    db.select({ count: count() }).from(monitors).where(sql`${monitors.isActive} = true`),
    db.select({ count: count() }).from(users).where(
      gte(users.createdAt, sql`NOW() - INTERVAL '24 hours'`)
    ),
    db.select({ count: count() }).from(results).where(
      gte(results.createdAt, sql`NOW() - INTERVAL '24 hours'`)
    ),
  ]);

  return {
    totalUsers: totalUsers[0]?.count || 0,
    totalMonitors: totalMonitors[0]?.count || 0,
    totalResults: totalResults[0]?.count || 0,
    totalAiCost: Number(totalAiCost[0]?.total) || 0,
    activeMonitors: activeMonitors[0]?.count || 0,
    usersToday: usersToday[0]?.count || 0,
    resultsToday: resultsToday[0]?.count || 0,
  };
}

async function getSubscriptionBreakdown() {
  const breakdown = await db
    .select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .groupBy(users.subscriptionStatus);

  return breakdown;
}

async function getRecentUsers() {
  const recentUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      subscriptionStatus: users.subscriptionStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(10);

  return recentUsers;
}

async function getAiCostsByDay() {
  const costs = await db
    .select({
      date: sql<string>`DATE(${aiLogs.createdAt})`,
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, sql`NOW() - INTERVAL '30 days'`))
    .groupBy(sql`DATE(${aiLogs.createdAt})`)
    .orderBy(desc(sql`DATE(${aiLogs.createdAt})`))
    .limit(30);

  return costs;
}

async function getUserGrowth() {
  const growth = await db
    .select({
      date: sql<string>`DATE(${users.createdAt})`,
      count: count(),
    })
    .from(users)
    .where(gte(users.createdAt, sql`NOW() - INTERVAL '30 days'`))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`);

  return growth;
}

async function getPlatformDistribution() {
  const distribution = await db
    .select({
      platform: results.platform,
      count: count(),
    })
    .from(results)
    .groupBy(results.platform);

  return distribution;
}

async function getSentimentBreakdown() {
  const breakdown = await db
    .select({
      sentiment: results.sentiment,
      count: count(),
    })
    .from(results)
    .groupBy(results.sentiment);

  return breakdown;
}

async function getSystemHealth() {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Get AI call stats for last 24h
  const [aiStats, recentAiLogs] = await Promise.all([
    db
      .select({
        totalCalls: count(),
        avgLatency: sql<number>`AVG(${aiLogs.latencyMs})`,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, twentyFourHoursAgo)),
    db
      .select({
        createdAt: aiLogs.createdAt,
        latencyMs: aiLogs.latencyMs,
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, twentyFourHoursAgo))
      .orderBy(desc(aiLogs.createdAt))
      .limit(100),
  ]);

  // Calculate error rate (assume latency > 10000ms or null latency is an error)
  const errorCount = recentAiLogs.filter(
    (log) => log.latencyMs === null || log.latencyMs > 10000
  ).length;
  const errorRate24h = recentAiLogs.length > 0 ? (errorCount / recentAiLogs.length) * 100 : 0;

  // Simulate job data - in production, this would come from Inngest API
  const jobs = [
    {
      name: "run-monitors",
      lastRun: recentAiLogs[0]?.createdAt || null,
      status: "success" as const,
      runsLast24h: Math.floor((aiStats[0]?.totalCalls || 0) / 10),
      failuresLast24h: errorCount,
    },
    {
      name: "send-daily-digest",
      lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      status: "success" as const,
      runsLast24h: 1,
      failuresLast24h: 0,
    },
    {
      name: "send-weekly-digest",
      lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      status: "success" as const,
      runsLast24h: 0,
      failuresLast24h: 0,
    },
  ];

  // Health checks - assume healthy if we can query the database
  const healthChecks = {
    database: true, // If we got this far, database is working
    ai: aiStats[0]?.totalCalls ? aiStats[0].totalCalls > 0 : true,
    email: true, // Assume healthy
    polar: true, // Assume healthy
  };

  return {
    jobs,
    errorRate24h,
    avgResponseTime: Number(aiStats[0]?.avgLatency) || 0,
    totalApiCalls24h: Number(aiStats[0]?.totalCalls) || 0,
    healthChecks,
  };
}

async function getCostBreakdown() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get cost by plan
  const costByPlanQuery = await db
    .select({
      plan: users.subscriptionStatus,
      userCount: count(sql`DISTINCT ${aiLogs.userId}`),
      totalCost: sum(aiLogs.costUsd),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(users.subscriptionStatus);

  const costByPlan = costByPlanQuery.map((item) => ({
    plan: item.plan || "free",
    userCount: Number(item.userCount) || 0,
    totalCost: Number(item.totalCost) || 0,
    avgCostPerUser:
      Number(item.userCount) > 0
        ? Number(item.totalCost) / Number(item.userCount)
        : 0,
  }));

  // Get top users by cost
  const topUsersByCostQuery = await db
    .select({
      userId: aiLogs.userId,
      email: users.email,
      name: users.name,
      plan: users.subscriptionStatus,
      totalCost: sum(aiLogs.costUsd),
      aiCalls: count(),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiLogs.userId, users.email, users.name, users.subscriptionStatus)
    .orderBy(desc(sum(aiLogs.costUsd)))
    .limit(10);

  const topUsersByCost = topUsersByCostQuery.map((user) => ({
    userId: user.userId || "",
    email: user.email,
    name: user.name,
    plan: user.plan || "free",
    totalCost: Number(user.totalCost) || 0,
    aiCalls: Number(user.aiCalls) || 0,
  }));

  // Calculate averages
  const [totalStats, resultsCount] = await Promise.all([
    db
      .select({
        totalCost: sum(aiLogs.costUsd),
        userCount: count(sql`DISTINCT ${aiLogs.userId}`),
      })
      .from(aiLogs)
      .where(gte(aiLogs.createdAt, thirtyDaysAgo)),
    db.select({ count: count() }).from(results).where(gte(results.createdAt, thirtyDaysAgo)),
  ]);

  const totalCost = Number(totalStats[0]?.totalCost) || 0;
  const totalUsersWithCost = Number(totalStats[0]?.userCount) || 0;
  const totalResults = resultsCount[0]?.count || 0;

  // Paid users cost
  const paidUsersCostQuery = await db
    .select({
      totalCost: sum(aiLogs.costUsd),
      userCount: count(sql`DISTINCT ${aiLogs.userId}`),
    })
    .from(aiLogs)
    .innerJoin(users, eq(aiLogs.userId, users.id))
    .where(
      and(
        gte(aiLogs.createdAt, thirtyDaysAgo),
        sql`${users.subscriptionStatus} IN ('pro', 'enterprise')`
      )
    );

  const paidTotalCost = Number(paidUsersCostQuery[0]?.totalCost) || 0;
  const paidUserCount = Number(paidUsersCostQuery[0]?.userCount) || 0;

  // Get cost by model
  const costByModelQuery = await db
    .select({
      model: aiLogs.model,
      totalCost: sum(aiLogs.costUsd),
      totalCalls: count(),
      totalTokens: sum(sql`${aiLogs.promptTokens} + ${aiLogs.completionTokens}`),
    })
    .from(aiLogs)
    .where(gte(aiLogs.createdAt, thirtyDaysAgo))
    .groupBy(aiLogs.model)
    .orderBy(desc(sum(aiLogs.costUsd)));

  const costByModel = costByModelQuery.map((item) => ({
    model: item.model,
    totalCost: Number(item.totalCost) || 0,
    totalCalls: Number(item.totalCalls) || 0,
    totalTokens: Number(item.totalTokens) || 0,
  }));

  return {
    costByPlan,
    topUsersByCost,
    costByModel,
    avgCostPerUser: totalUsersWithCost > 0 ? totalCost / totalUsersWithCost : 0,
    avgCostPerPaidUser: paidUserCount > 0 ? paidTotalCost / paidUserCount : 0,
    costPerResult: totalResults > 0 ? totalCost / totalResults : 0,
  };
}

async function getBusinessMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get subscription counts - ONLY count users who actually paid via Polar
  const [currentSubs, paidUsers, lastMonthSubs, monthlySignups] = await Promise.all([
    // Current subscription breakdown (all users for display)
    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .groupBy(users.subscriptionStatus),

    // REAL paid users - only those with Polar subscription ID
    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .where(sql`${users.polarSubscriptionId} IS NOT NULL`)
    .groupBy(users.subscriptionStatus),

    // Last month paid users with Polar subscription
    db.select({
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .where(
      and(
        lt(users.createdAt, startOfMonth),
        sql`${users.polarSubscriptionId} IS NOT NULL`
      )
    )
    .groupBy(users.subscriptionStatus),

    // New signups this month
    db.select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, startOfMonth)),
  ]);

  // Calculate current MRR - ONLY from users who actually paid via Polar
  const paidProUsers = paidUsers.find(s => s.status === "pro")?.count || 0;
  const paidEnterpriseUsers = paidUsers.find(s => s.status === "enterprise")?.count || 0;

  // Total users for conversion rate calculation
  const currentFreeUsers = currentSubs.find(s => s.status === "free")?.count || 0;
  const currentProUsers = currentSubs.find(s => s.status === "pro")?.count || 0;
  const currentEnterpriseUsers = currentSubs.find(s => s.status === "enterprise")?.count || 0;
  const totalUsers = currentProUsers + currentEnterpriseUsers + currentFreeUsers;

  // MRR from REAL Polar payments only
  const mrr = (paidProUsers * PLANS.pro.price) + (paidEnterpriseUsers * PLANS.enterprise.price);

  // Calculate last month MRR for comparison (from real Polar payments)
  const lastMonthPaidProUsers = lastMonthSubs.find(s => s.status === "pro")?.count || 0;
  const lastMonthPaidEnterpriseUsers = lastMonthSubs.find(s => s.status === "enterprise")?.count || 0;
  const lastMonthMrr = (lastMonthPaidProUsers * PLANS.pro.price) + (lastMonthPaidEnterpriseUsers * PLANS.enterprise.price);

  // MRR change percentage
  const mrrChange = lastMonthMrr > 0 ? ((mrr - lastMonthMrr) / lastMonthMrr) * 100 : (mrr > 0 ? 100 : 0);

  // ARR (Annual Recurring Revenue)
  const arr = mrr * 12;

  // ARPU (Average Revenue Per User) - across all users including free
  const avgRevenuePerUser = totalUsers > 0 ? mrr / totalUsers : 0;

  // Paid user percentage (users who actually paid, not just status)
  const totalPaidUsers = paidProUsers + paidEnterpriseUsers;
  const paidUserPercentage = totalUsers > 0 ? (totalPaidUsers / totalUsers) * 100 : 0;

  // Conversion metrics (based on actual Polar payments)
  const proConversions = paidProUsers - lastMonthPaidProUsers;
  const enterpriseConversions = paidEnterpriseUsers - lastMonthPaidEnterpriseUsers;

  // Calculate conversion rate (actually paid users / total users)
  const conversionRate = totalUsers > 0 ? (totalPaidUsers / totalUsers) * 100 : 0;

  // Last month conversion rate for comparison
  const lastMonthTotalPaidUsers = lastMonthPaidProUsers + lastMonthPaidEnterpriseUsers;
  const lastMonthTotalUsers = currentSubs.reduce((sum, s) => sum + (s.count || 0), 0) - (monthlySignups[0]?.count || 0);
  const lastMonthConversionRate = lastMonthTotalUsers > 0
    ? (lastMonthTotalPaidUsers / lastMonthTotalUsers) * 100
    : 0;
  const conversionRateChange = conversionRate - lastMonthConversionRate;

  return {
    mrr,
    mrrChange,
    arr,
    conversionRate,
    conversionRateChange,
    avgRevenuePerUser,
    proConversions: Math.max(0, proConversions),
    enterpriseConversions: Math.max(0, enterpriseConversions),
    monthlySignups: monthlySignups[0]?.count || 0,
    paidUserPercentage,
  };
}

async function getErrorLogsSummary() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [stats, recentErrors] = await Promise.all([
    // Get error stats for last 7 days
    db
      .select({
        total: count(),
        unresolved: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.resolved} = false)`,
        errorCount: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.level} = 'error')`,
        warningCount: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.level} = 'warning')`,
        fatalCount: sql<number>`COUNT(*) FILTER (WHERE ${errorLogs.level} = 'fatal')`,
      })
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, sevenDaysAgo)),
    // Get recent unresolved errors
    db.query.errorLogs.findMany({
      where: and(
        eq(errorLogs.resolved, false),
        gte(errorLogs.createdAt, sevenDaysAgo)
      ),
      orderBy: [desc(errorLogs.createdAt)],
      limit: 5,
      columns: {
        id: true,
        level: true,
        source: true,
        message: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    total: Number(stats[0]?.total) || 0,
    unresolved: Number(stats[0]?.unresolved) || 0,
    byLevel: {
      error: Number(stats[0]?.errorCount) || 0,
      warning: Number(stats[0]?.warningCount) || 0,
      fatal: Number(stats[0]?.fatalCount) || 0,
    },
    recentErrors: recentErrors.map(e => ({
      id: e.id,
      level: e.level,
      source: e.source,
      message: e.message,
      createdAt: e.createdAt?.toISOString() || new Date().toISOString(),
    })),
  };
}

export default async function ManagePage() {
  // Auth is handled by the layout - in dev mode, no auth required
  const [stats, subscriptionBreakdown, recentUsers, aiCosts, userGrowth, platformDist, sentimentDist, businessMetrics, costBreakdown, systemHealth, errorLogsSummary] = await Promise.all([
    getAdminStats(),
    getSubscriptionBreakdown(),
    getRecentUsers(),
    getAiCostsByDay(),
    getUserGrowth(),
    getPlatformDistribution(),
    getSentimentBreakdown(),
    getBusinessMetrics(),
    getCostBreakdown(),
    getSystemHealth(),
    getErrorLogsSummary(),
  ]);

  const freeUsers = subscriptionBreakdown.find(s => s.status === "free")?.count || 0;
  const proUsers = subscriptionBreakdown.find(s => s.status === "pro")?.count || 0;
  const enterpriseUsers = subscriptionBreakdown.find(s => s.status === "enterprise")?.count || 0;

  return (
    <ResponsiveManage
      stats={stats}
      freeUsers={freeUsers}
      proUsers={proUsers}
      enterpriseUsers={enterpriseUsers}
      userGrowth={userGrowth}
      aiCosts={aiCosts}
      platformDist={platformDist}
      sentimentDist={sentimentDist}
      recentUsers={recentUsers}
      businessMetrics={businessMetrics}
      costBreakdown={costBreakdown}
      systemHealth={systemHealth}
      errorLogsSummary={errorLogsSummary}
    />
  );
}
